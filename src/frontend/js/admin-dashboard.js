// State
let allOrders = [];
let allProducts = [];
let currentFilter = 'PENDING';
let currentOrder = null;
let currentProduct = null;
let pendingImageFile = null;

document.addEventListener('DOMContentLoaded', () => {
    loadOrders();
    loadProducts();
    initImageUpload();

    // Event Listeners for tabs
    document.getElementById('nav-orders')?.addEventListener('click', () => switchView('orders'));
    document.getElementById('nav-products')?.addEventListener('click', () => switchView('products'));
    document.getElementById('nav-settings')?.addEventListener('click', () => switchView('settings'));

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderOrders(e.target.value);
        });
    }

    // Password change form
    const pwForm = document.getElementById('passwordForm');
    if (pwForm) {
        pwForm.addEventListener('submit', changePassword);
    }

    // Password reset button
    const resetBtn = document.getElementById('resetPasswordBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', sendPasswordReset);
    }
});

// ==================== IMAGE UPLOAD ====================

function initImageUpload() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('imageFileInput');

    if (!dropZone || !fileInput) return;

    // Click to select file
    dropZone.addEventListener('click', () => fileInput.click());

    // File selected
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageFile(e.target.files[0]);
        }
    });

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-orange-500', 'bg-orange-500/10');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-orange-500', 'bg-orange-500/10');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-orange-500', 'bg-orange-500/10');

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleImageFile(e.dataTransfer.files[0]);
        }
    });
}

function handleImageFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Bitte nur Bilddateien hochladen!');
        return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Bild zu groß! Maximale Größe: 5MB');
        return;
    }

    pendingImageFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('imagePreview');
        const container = document.getElementById('imagePreviewContainer');
        const dropZone = document.getElementById('dropZone');

        if (preview && container && dropZone) {
            preview.src = e.target.result;
            container.classList.remove('hidden');
            dropZone.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    pendingImageFile = null;
    document.getElementById('editProductImage').value = '';
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    document.getElementById('dropZone').classList.remove('hidden');
    document.getElementById('imageFileInput').value = '';
}

function switchView(view) {
    const views = ['view-orders', 'view-products', 'view-settings'];
    const buttons = ['nav-orders', 'nav-products', 'nav-settings'];

    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    buttons.forEach(b => {
        const el = document.getElementById(b);
        if (el) el.className = 'glass-button-secondary px-6 py-2';
    });

    const activeView = document.getElementById(`view-${view}`);
    const activeBtn = document.getElementById(`nav-${view}`);

    if (activeView) activeView.classList.remove('hidden');
    if (activeBtn) activeBtn.className = 'glass-button px-6 py-2';
}

// ==================== ORDERS ====================

async function loadOrders() {
    try {
        const res = await fetch('/api/admin/orders');
        if (res.status === 401 || res.status === 403) {
            window.location.href = '/admin/login';
            return;
        }
        if (!res.ok) throw new Error('Failed');
        allOrders = await res.json();
        console.log('Orders loaded:', allOrders.length);
        renderOrders();
    } catch (e) {
        console.error('Load Orders Error:', e);
        const list = document.getElementById('ordersList');
        if (list) list.innerHTML = '<div class="text-red-400 text-center py-8">Fehler beim Laden der Bestellungen.</div>';
    }
}

function filterStatus(status) {
    currentFilter = status;
    ['PENDING', 'PROCESSING', 'COMPLETED'].forEach(s => {
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
    renderOrders(document.getElementById('searchInput')?.value || '');
}

function renderOrders(term = '') {
    const list = document.getElementById('ordersList');
    if (!list) return;
    list.innerHTML = '';

    const lowerTerm = term.toLowerCase();
    const filtered = allOrders.filter(o => {
        let matchesStatus = o.status === currentFilter;
        if (currentFilter === 'PENDING' && o.status === 'OPEN') matchesStatus = true;
        if (!matchesStatus) return false;

        const info = typeof o.customer_info === 'string' ? JSON.parse(o.customer_info) : o.customer_info;
        const name = (info.billing?.name || '').toLowerCase();
        const email = (info.email || '').toLowerCase();
        const id = String(o.id);
        return name.includes(lowerTerm) || email.includes(lowerTerm) || id.includes(lowerTerm);
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
        el.onclick = () => openOrderModal(order);

        el.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-orange-500 font-bold font-serif">#${order.id}</div>
                <div>
                    <h3 class="font-bold text-white group-hover:text-orange-400 transition-colors">${info.billing?.name || 'Unbekannt'}</h3>
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
    return items.reduce((s, i) => s + i.quantity, 0);
}

// Order Modal
function openOrderModal(order) {
    currentOrder = order;
    const modal = document.getElementById('orderModal');
    const info = typeof order.customer_info === 'string' ? JSON.parse(order.customer_info) : order.customer_info;

    document.getElementById('modalId').textContent = order.id;
    document.getElementById('modalDate').textContent = new Date(order.created_at).toLocaleDateString('de-DE');

    // Populate billing address (edit form)
    document.getElementById('editName').value = info.billing?.name || '';
    document.getElementById('editStreet').value = info.billing?.street || '';
    document.getElementById('editZip').value = info.billing?.zip || '';
    document.getElementById('editCity').value = info.billing?.city || '';
    document.getElementById('editEmail').value = info.email || '';
    document.getElementById('editPrice').value = order.total_price;

    // Check for shipping address and populate if exists
    const shippingSection = document.getElementById('shippingAddressSection');
    const hasShipping = info.shipping && info.shipping.name;

    if (hasShipping) {
        shippingSection.classList.remove('hidden');
        document.getElementById('editShippingName').value = info.shipping.name || '';
        document.getElementById('editShippingStreet').value = info.shipping.street || '';
        document.getElementById('editShippingZip').value = info.shipping.zip || '';
        document.getElementById('editShippingCity').value = info.shipping.city || '';
    } else {
        shippingSection.classList.add('hidden');
    }

    // Items table
    const tbody = document.getElementById('modalItems');
    tbody.innerHTML = '';
    (order.items || []).forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-4">
                <div class="font-bold text-white">${item.product_name}</div>
            </td>
            <td class="p-4">${item.quantity}x</td>
            <td class="p-4">${item.price_at_purchase.toFixed(2)} €</td>
            <td class="p-4 font-bold text-white">${(item.quantity * item.price_at_purchase).toFixed(2)} €</td>
        `;
        tbody.appendChild(row);
    });

    // Personalization Section
    const persSection = document.getElementById('personalizationSection');
    const persList = document.getElementById('personalizationList');

    const itemsWithCustomization = (order.items || []).filter(item => item.custom_text);

    if (itemsWithCustomization.length > 0) {
        persSection.classList.remove('hidden');
        persList.innerHTML = '';

        itemsWithCustomization.forEach(item => {
            const fontClass = getFontClass(item.custom_font);
            const div = document.createElement('div');
            div.className = 'bg-white/5 p-4 rounded-lg border border-green-500/20';
            div.innerHTML = `
                <div class="text-xs text-stone-400 mb-1">${item.product_name} (${item.quantity}x)</div>
                <div class="text-lg text-white ${fontClass} p-2 bg-stone-800 rounded">"${item.custom_text}"</div>
                <div class="text-xs text-green-400 mt-2">Schriftart: ${item.custom_font || 'Standard'}</div>
            `;
            persList.appendChild(div);
        });
    } else {
        persSection.classList.add('hidden');
    }

    generateEmailTemplate(order, info);
    modal.classList.remove('hidden');
}

function getFontClass(fontName) {
    const fonts = {
        'Standard': 'font-sans',
        'Schreibschrift': 'italic',
        'Klassisch': 'font-serif',
        'Handschrift': 'font-sans'
    };
    return fonts[fontName] || 'font-sans';
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.add('hidden');
    currentOrder = null;
}

async function updateStatus(s) {
    if (!currentOrder) return;
    if (!confirm(`Status auf "${s}" ändern?`)) return;

    try {
        const res = await fetch(`/api/admin/orders/${currentOrder.id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: s })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Status aktualisiert!');
            closeOrderModal();
            loadOrders();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    } catch (e) {
        console.error(e);
        alert('Netzwerkfehler');
    }
}

async function saveOrder() {
    if (!currentOrder) return;

    const info = typeof currentOrder.customer_info === 'string' ? JSON.parse(currentOrder.customer_info) : currentOrder.customer_info;

    // Check if shipping address fields exist and have values
    const shippingName = document.getElementById('editShippingName')?.value;
    const hasShipping = shippingName && shippingName.trim() !== '';

    const updatedInfo = {
        billing: {
            name: document.getElementById('editName').value,
            street: document.getElementById('editStreet').value,
            zip: document.getElementById('editZip').value,
            city: document.getElementById('editCity').value
        },
        shipping: hasShipping ? {
            name: shippingName,
            street: document.getElementById('editShippingStreet').value,
            zip: document.getElementById('editShippingZip').value,
            city: document.getElementById('editShippingCity').value
        } : null,
        email: document.getElementById('editEmail').value
    };

    const newPrice = parseFloat(document.getElementById('editPrice').value);

    try {
        const res = await fetch(`/api/admin/orders/${currentOrder.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                customer_info: updatedInfo,
                total_price: newPrice
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Bestellung gespeichert!');
            closeOrderModal();
            loadOrders();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    } catch (e) {
        console.error(e);
        alert('Netzwerkfehler');
    }
}

async function deleteOrder() {
    if (!currentOrder) return;
    if (!confirm(`Bestellung #${currentOrder.id} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) return;

    try {
        const res = await fetch(`/api/admin/orders/${currentOrder.id}`, {
            method: 'DELETE'
        });

        const data = await res.json();

        if (res.ok) {
            alert('Bestellung gelöscht!');
            closeOrderModal();
            loadOrders();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    } catch (e) {
        console.error(e);
        alert('Netzwerkfehler');
    }
}

function generateEmailTemplate(order, info) {
    const box = document.getElementById('emailTemplate');
    if (!box) return;

    const name = info.billing?.name || 'Kunde';
    const firstName = name.split(' ')[0];

    let t = `Hallo ${firstName},\n\n`;
    t += `vielen Dank für deine Bestellung bei Nicos Dekoscheune!\n\n`;
    t += `═══════════════════════════════════\n`;
    t += `BESTELLNUMMER: #${order.id}\n`;
    t += `DATUM: ${new Date(order.created_at).toLocaleDateString('de-DE')}\n`;
    t += `═══════════════════════════════════\n\n`;

    t += `BESTELLTE ARTIKEL:\n`;
    t += `-----------------------------------\n`;
    (order.items || []).forEach(item => {
        t += `• ${item.quantity}x ${item.product_name}`;
        if (item.custom_text) t += ` (${item.custom_text})`;
        if (item.custom_font && item.custom_font !== 'Standard') t += ` [Schrift: ${item.custom_font}]`;
        t += ` - ${(item.quantity * item.price_at_purchase).toFixed(2)} €\n`;
    });
    t += `-----------------------------------\n`;

    const shipping = order.shipping_method === 'pickup' ? 'Selbstabholung (0,00 €)' : `Versand (${(order.shipping_cost || 5.99).toFixed(2)} €)`;
    t += `Versandart: ${shipping}\n`;
    t += `\n`;
    t += `GESAMTSUMME: ${order.total_price.toFixed(2)} €\n`;
    t += `═══════════════════════════════════\n\n`;

    // Check if shipping address is different from billing
    const hasShippingAddress = info.shipping &&
        info.shipping.name &&
        info.shipping.name !== info.billing?.name;

    t += `RECHNUNGSADRESSE:\n`;
    t += `${info.billing?.name}\n`;
    t += `${info.billing?.street}\n`;
    t += `${info.billing?.zip} ${info.billing?.city}\n\n`;

    if (hasShippingAddress) {
        t += `LIEFERADRESSE (abweichend):\n`;
        t += `${info.shipping.name}\n`;
        t += `${info.shipping.street}\n`;
        t += `${info.shipping.zip} ${info.shipping.city}\n\n`;
    }

    t += `═══════════════════════════════════\n`;
    t += `ZAHLUNG\n`;
    t += `═══════════════════════════════════\n\n`;
    t += `Bitte überweise den Betrag von ${order.total_price.toFixed(2)} € auf folgendes PayPal-Konto:\n\n`;
    t += `PayPal-Handle: @nicohauser\n`;
    t += `oder per E-Mail: nico_hauser@yahoo.de\n`;
    t += `PayPal-Link: https://paypal.me/nicohauser/${order.total_price.toFixed(2)}\n\n`;
    t += `Verwendungszweck: Bestellung #${order.id}\n\n`;

    if (order.status === 'PENDING') {
        t += `Sobald deine Zahlung eingegangen ist, bearbeiten wir deine Bestellung.\n\n`;
    } else if (order.status === 'PROCESSING') {
        t += `Deine Bestellung wird gerade bearbeitet.\n\n`;
    } else if (order.status === 'COMPLETED') {
        if (order.shipping_method === 'pickup') {
            t += `Deine Bestellung liegt zur Abholung bereit! Bitte melde dich für einen Termin.\n\n`;
        } else {
            t += `Deine Bestellung wurde versendet und sollte in 2-3 Werktagen bei dir ankommen.\n\n`;
        }
    }

    t += `Bei Fragen erreichst du mich jederzeit unter dieser E-Mail.\n\n`;
    t += `Liebe Grüße,\nNico von Nicos Dekoscheune`;

    box.value = t;
}

function copyEmail() {
    const el = document.getElementById('emailTemplate');
    if (el) {
        el.select();
        document.execCommand('copy');
        alert('E-Mail Vorlage kopiert!');
    }
}

// ==================== PRODUCTS ====================

async function loadProducts() {
    try {
        // FIXED: Correct API endpoint
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Failed to load products');
        allProducts = await res.json();
        console.log('Products loaded:', allProducts.length);
        renderProducts();
    } catch (e) {
        console.error('Load Products Error:', e);
        const container = document.getElementById('productsList');
        if (container) container.innerHTML = '<div class="text-red-400 py-8 col-span-full text-center">Fehler beim Laden der Produkte.</div>';
    }
}

function renderProducts() {
    const container = document.getElementById('productsList');
    if (!container) return;
    container.innerHTML = '';

    if (allProducts.length === 0) {
        container.innerHTML = '<div class="text-stone-500 py-8 italic col-span-full text-center">Keine Produkte vorhanden.</div>';
        return;
    }

    allProducts.forEach(p => {
        const el = document.createElement('div');
        el.className = 'glass-panel p-4 flex items-center gap-4';
        el.innerHTML = `
            <img src="${p.image_url || '/logo.png'}" class="w-16 h-16 rounded object-cover bg-white/10" onerror="this.src='/logo.png'">
            <div class="flex-1">
                <h3 class="font-bold text-white">${p.name}</h3>
                <p class="text-xs text-stone-400">${p.category || 'Keine Kategorie'} • Bestand: ${p.stock}</p>
            </div>
            <div class="text-right space-y-2">
                <span class="block font-bold text-white">${p.price.toFixed(2)} €</span>
                <div class="flex gap-2">
                    <button onclick="openProductModal(${p.id})" class="text-xs glass-button-secondary py-1 px-2">Bearbeiten</button>
                    <button onclick="deleteProduct(${p.id})" class="text-xs bg-red-500/20 text-red-400 border border-red-500/30 py-1 px-2 rounded-full hover:bg-red-500/30">Löschen</button>
                </div>
            </div>
        `;
        container.appendChild(el);
    });
}

function openProductModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    currentProduct = product;
    const modal = document.getElementById('productModal');

    document.getElementById('productModalTitle').textContent = `Produkt #${product.id} bearbeiten`;
    document.getElementById('editProductName').value = product.name;
    document.getElementById('editProductCategory').value = product.category || '';
    document.getElementById('editProductPrice').value = product.price;
    document.getElementById('editProductStock').value = product.stock;
    document.getElementById('editProductImage').value = product.image_url || '';
    document.getElementById('editProductDescription').value = product.description || '';

    // Reset image upload state
    pendingImageFile = null;
    document.getElementById('imageFileInput').value = '';

    // Show existing image if present
    if (product.image_url) {
        document.getElementById('imagePreview').src = product.image_url;
        document.getElementById('imagePreviewContainer').classList.remove('hidden');
        document.getElementById('dropZone').classList.add('hidden');
    } else {
        document.getElementById('imagePreviewContainer').classList.add('hidden');
        document.getElementById('dropZone').classList.remove('hidden');
    }

    modal.classList.remove('hidden');
}

function openNewProductModal() {
    currentProduct = null; // null = new product
    pendingImageFile = null;
    const modal = document.getElementById('productModal');

    document.getElementById('productModalTitle').textContent = 'Neues Produkt erstellen';
    document.getElementById('editProductName').value = '';
    document.getElementById('editProductCategory').value = '';
    document.getElementById('editProductPrice').value = '';
    document.getElementById('editProductStock').value = '1';
    document.getElementById('editProductImage').value = '';
    document.getElementById('editProductDescription').value = '';

    // Reset image upload
    document.getElementById('imageFileInput').value = '';
    document.getElementById('imagePreviewContainer').classList.add('hidden');
    document.getElementById('dropZone').classList.remove('hidden');

    modal.classList.remove('hidden');
}

function closeProductModal() {
    document.getElementById('productModal').classList.add('hidden');
    currentProduct = null;
    pendingImageFile = null;
}

async function saveProduct() {
    const name = document.getElementById('editProductName').value.trim();
    const price = parseFloat(document.getElementById('editProductPrice').value);
    const stock = parseInt(document.getElementById('editProductStock').value);

    if (!name) {
        alert('Bitte einen Namen eingeben!');
        return;
    }
    if (isNaN(price) || price <= 0) {
        alert('Bitte einen gültigen Preis eingeben!');
        return;
    }

    try {
        let res;

        // Use FormData if there's an image file to upload
        if (pendingImageFile) {
            const formData = new FormData();
            formData.append('name', name);
            formData.append('category', document.getElementById('editProductCategory').value);
            formData.append('price_net', price.toString());
            formData.append('stock', (stock || 1).toString());
            formData.append('description', document.getElementById('editProductDescription').value);
            formData.append('tax_rate', '0');
            formData.append('image', pendingImageFile);

            if (currentProduct) {
                res = await fetch(`/api/products/${currentProduct.id}`, {
                    method: 'PUT',
                    body: formData
                });
            } else {
                res = await fetch('/api/products', {
                    method: 'POST',
                    body: formData
                });
            }
        } else {
            // No new image - use JSON
            const updates = {
                name: name,
                category: document.getElementById('editProductCategory').value,
                price_net: price,
                stock: stock || 1,
                image_url: document.getElementById('editProductImage').value,
                description: document.getElementById('editProductDescription').value,
                tax_rate: 0
            };

            if (currentProduct) {
                res = await fetch(`/api/products/${currentProduct.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                });
            } else {
                res = await fetch('/api/products', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                });
            }
        }

        const data = await res.json();

        if (res.ok) {
            alert(currentProduct ? 'Produkt gespeichert!' : 'Produkt erstellt!');
            closeProductModal();
            loadProducts();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    } catch (e) {
        console.error(e);
        alert('Netzwerkfehler');
    }
}

async function deleteProduct(productId) {
    if (!confirm('Produkt wirklich löschen?')) return;

    try {
        const res = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        const data = await res.json();

        if (res.ok) {
            alert('Produkt gelöscht!');
            loadProducts();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    } catch (e) {
        console.error(e);
        alert('Netzwerkfehler');
    }
}

// ==================== SETTINGS ====================

async function changePassword(e) {
    e.preventDefault();

    const currentPw = document.getElementById('currentPassword').value;
    const newPw = document.getElementById('newPassword').value;
    const confirmPw = document.getElementById('confirmPassword').value;

    if (newPw !== confirmPw) {
        alert('Die neuen Passwörter stimmen nicht überein!');
        return;
    }

    if (newPw.length < 8) {
        alert('Das neue Passwort muss mindestens 8 Zeichen haben!');
        return;
    }

    try {
        const res = await fetch('/api/admin/change-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentPassword: currentPw,
                newPassword: newPw
            })
        });

        const data = await res.json();

        if (res.ok) {
            alert('Passwort erfolgreich geändert!');
            document.getElementById('passwordForm').reset();
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    } catch (e) {
        console.error(e);
        alert('Netzwerkfehler');
    }
}

async function sendPasswordReset() {
    if (!confirm('Soll ein Passwort-Reset-Link an die Admin-E-Mail gesendet werden?')) {
        return;
    }

    const btn = document.getElementById('resetPasswordBtn');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Wird gesendet...';

    try {
        const res = await fetch('/api/admin/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (res.ok) {
            document.getElementById('resetSuccess').classList.remove('hidden');
            btn.classList.add('hidden');
        } else {
            alert('Fehler: ' + (data.error || 'Unbekannter Fehler'));
        }
    } catch (e) {
        console.error(e);
        alert('Netzwerkfehler');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function logout() {
    document.cookie = 'auth_token=; Max-Age=0; path=/;';
    window.location.href = '/admin/login';
}
