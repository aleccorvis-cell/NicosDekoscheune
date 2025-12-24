document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');

    // Auth Check
    async function checkAuth() {
        try {
            const res = await fetch('/api/admin/orders'); // Try accessing protected route
            if (res.status === 401 || res.status === 403) {
                window.location.href = '/admin/login';
            } else {
                // Assuming loadProducts() is defined elsewhere or will be added
                // loadProducts();
                loadOrders();
            }
        } catch {
            window.location.href = '/admin/login';
        }
    }

    // UI Switching
    window.showSection = (section) => {
        document.getElementById('productsSection').classList.add('hidden');
        document.getElementById('ordersSection').classList.add('hidden');

        if (section === 'products') document.getElementById('productsSection').classList.remove('hidden');
        if (section === 'orders') document.getElementById('ordersSection').classList.remove('hidden');

        // Update Sidebar active state (simple visual trick)
        // ... (could add class toggling here later)
    };

    // --- Product Logic ---

    let editId = null; // Track if we are editing

    window.openModal = () => {
        resetModal();
        document.getElementById('productModal').classList.remove('hidden');
        showStep(1);
    };

    window.closeModal = () => {
        document.getElementById('productModal').classList.add('hidden');
        resetModal();
    };

    function resetModal() {
        editId = null;
        document.getElementById('productForm').reset();
        document.getElementById('modalTitle').textContent = 'Neues Produkt anlegen';
        document.getElementById('submitBtn').textContent = 'Produkt erstellen';
        document.getElementById('fileNameDisplay').classList.add('hidden');
        showStep(1);
    }

    // Edit Product
    window.editProduct = async (id) => {
        try {
            const res = await fetch(`/api/products/${id}`);
            const product = await res.json();

            editId = id;

            // Open Modal & Fill Data
            document.getElementById('productModal').classList.remove('hidden');
            document.getElementById('modalTitle').textContent = 'Produkt bearbeiten';
            document.getElementById('submitBtn').textContent = 'Änderungen speichern';

            const form = document.getElementById('productForm');
            form.name.value = product.name;
            form.category.value = product.category;
            form.description.value = product.description;

            // Calculate Net from Gross for display (API returns Gross price)
            const taxRate = product.tax_rate;
            const net = product.price / (1 + taxRate);
            form.price_net.value = net.toFixed(2);

            form.stock.value = product.stock;

            // Tax Radio
            if (taxRate > 0) document.getElementById('tax19').checked = true;
            else document.getElementById('tax0').checked = true;

            // Show FileName if image exists (can't prefill file input)
            if (product.image_url) {
                const display = document.getElementById('fileNameDisplay');
                display.textContent = 'Aktuelles Bild: ' + product.image_url.split('/').pop();
                display.classList.remove('hidden');
            }

            // Trigger Calc
            updateCalculation();
            showStep(1);

        } catch (e) {
            console.error(e);
            alert('Fehler beim Laden des Produkts');
        }
    };

    window.deleteProduct = async (id) => {
        if (!confirm('Wirklich löschen?')) return;
        await fetch(`/api/products/${id}`, { method: 'DELETE' });
        loadProducts();
    };

    // Wizard Steps
    let currentStep = 1;
    function showStep(step) {
        currentStep = step;
        document.querySelectorAll('.wizard-step').forEach(el => el.classList.add('hidden'));
        document.querySelector(`.wizard-step[data-step="${step}"]`).classList.remove('hidden');

        // Update Indicators
        document.querySelectorAll('.step-indicator').forEach(el => {
            const s = parseInt(el.dataset.step);
            if (s === step) el.className = 'w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center border-2 border-white step-indicator schema-active';
            else if (s < step) el.className = 'w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center border-2 border-white step-indicator';
            else el.className = 'w-8 h-8 rounded-full bg-gray-300 text-white flex items-center justify-center border-2 border-white step-indicator';
        });

        // Buttons
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');

        if (step === 1) prevBtn.classList.add('hidden');
        else prevBtn.classList.remove('hidden');

        if (step === 6) {
            nextBtn.classList.add('hidden');
            submitBtn.classList.remove('hidden');
        } else {
            nextBtn.classList.remove('hidden');
            submitBtn.classList.add('hidden');
        }
    }

    document.getElementById('nextBtn').addEventListener('click', () => {
        if (validateStep(currentStep)) showStep(currentStep + 1);
    });

    document.getElementById('prevBtn').addEventListener('click', () => {
        showStep(currentStep - 1);
    });

    function validateStep(step) {
        const form = document.getElementById('productForm');
        if (step === 2) {
            if (!form.name.value) { alert('Name fehlt'); return false; }
            if (!form.category.value) { alert('Kategorie fehlt'); return false; }
        }
        if (step === 4 && !form.price_net.value) { alert('Preis fehlt'); return false; }
        return true;
    }

    // Tax Calculation
    function updateCalculation() {
        const form = document.getElementById('productForm');
        const net = parseFloat(form.price_net.value) || 0;
        const taxRate = parseFloat(document.querySelector('input[name="tax_rate"]:checked').value);

        const tax = net * taxRate;
        const gross = net + tax; // Gross is what user pays

        document.getElementById('calcNet').textContent = net.toFixed(2) + ' €';
        document.getElementById('calcTax').textContent = tax.toFixed(2) + ' €';
        document.getElementById('calcGross').textContent = gross.toFixed(2) + ' €';
    }

    document.getElementById('productForm').addEventListener('input', updateCalculation);

    // Submit (Create or Update)
    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        // Convert tax/net to Gross for DB if logic requires, OR backend handles it.
        // Our backend expects: price (Gross), tax_rate.
        // So we don't need to change payload structure, backend does the math? 
        // Wait, backend route currently expects 'price' as GROSS. 
        // We send 'price_net' and 'tax_rate'. 
        // Let's check backend logic. The backend calculates Gross from Net if 'price' is not provided?
        // Looking at productRoutes.ts: It expects 'price' (Gross) OR calculates it?
        // Actually, let's send 'price' as the calculated Gross value to be safe.

        const net = parseFloat(formData.get('price_net'));
        const taxRate = parseFloat(formData.get('tax_rate'));
        const gross = net * (1 + taxRate);
        formData.append('price', gross.toFixed(2));

        try {
            const url = editId ? `/api/products/${editId}` : '/api/products';
            const method = editId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method: method,
                body: formData // Fetch handles Multipart automatically
            });

            if (res.ok) {
                closeModal();
                loadProducts();

                // Show Toast
                const toast = document.getElementById('toast');
                toast.textContent = editId ? 'Produkt aktualisiert!' : 'Produkt erstellt!';
                toast.classList.remove('translate-y-20');
                setTimeout(() => toast.classList.add('translate-y-20'), 3000);
            } else {
                const err = await res.json();
                alert('Fehler: ' + JSON.stringify(err));
            }
        } catch (e) {
            console.error(e);
            alert('Netzwerkfehler');
        }
    });

    // --- Orders Logic ---
    async function loadOrders() {
        const tbody = document.getElementById('orderTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Lade...</td></tr>';

        try {
            const res = await fetch('/api/admin/orders');
            const orders = await res.json();

            tbody.innerHTML = '';
            if (orders.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-gray-500">Keine Bestellungen vorhanden.</td></tr>';
                return;
            }

            orders.forEach(order => {
                const tr = document.createElement('tr');
                const date = new Date(order.created_at).toLocaleString('de-DE');
                const statusClass = order.status === 'SHIPPED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
                const paymentInfo = order.payment_method === 'PAYPAL' ? '<span class="font-bold text-blue-600">PayPal</span>' : 'Vorkasse';

                tr.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">#${order.id}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${date}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ${order.customer_info.name}<br>
                        <span class="text-xs font-normal text-gray-500">${order.customer_info.email}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">${order.total_price.toFixed(2)} €</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${paymentInfo}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                            ${order.status === 'PENDING' ? 'Offen' : (order.status === 'SHIPPED' ? 'Versendet' : order.status)}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="editProduct(${product.id})" class="text-indigo-600 hover:text-indigo-900 mr-4">Bearbeiten</button>
                    <button onclick="deleteProduct(${product.id})" class="text-red-600 hover:text-red-900">Löschen</button>
                </td>
            `;
                tbody.appendChild(tr);
            });

        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-red-500">Fehler beim Laden.</td></tr>';
        }
    }

    window.updateStatus = async (id, status) => {
        if (!confirm(`Bestellung #${id} wirklich als "${status}" markieren?`)) return;

        try {
            const res = await fetch(`/api/admin/orders/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                loadOrders();
            } else {
                alert('Fehler beim Aktualisieren.');
            }
        } catch (e) {
            alert('Netzwerkfehler');
        }
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/admin/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    window.location.href = '/admin/login';
                } else {
                    console.error('Logout failed');
                    // Fallback redirect anyway, better to be safe
                    window.location.href = '/admin/login';
                }
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = '/admin/login';
            }
        });
    }
});
