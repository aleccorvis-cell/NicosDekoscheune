document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Cart
    // 1. Load Cart
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const submitBtn = document.getElementById('submitOrderBtn');
    const errorMsg = document.getElementById('errorMsg');

    if (cart.length === 0) {
        alert('Ihr Warenkorb ist leer.');
        window.location.href = '/';
        return;
    }

    // Render Cart
    let total = 0;

    function renderCartItems() {
        console.log('Rendering Checkout Items...');
        const cartStr = localStorage.getItem('cart');
        console.log('Cart String:', cartStr);

        let cart = [];
        try {
            cart = JSON.parse(cartStr || '[]');
        } catch (e) { console.error('Error parsing cart', e); }

        const container = document.getElementById('checkoutCartItems');
        const subtotalEl = document.getElementById('subtotalPrice');
        const shippingEl = document.getElementById('shippingPrice');
        const totalEl = document.getElementById('totalPrice');
        const totalBreakdownEl = document.getElementById('totalPriceBreakdown');

        if (!container) return;

        container.innerHTML = '';
        let subtotal = 0;
        let vatTotal = 0;

        // Ensure we handle empty cart properly
        if (cart.length === 0) {
            container.innerHTML = '<p class="text-stone-400 text-center italic">Warenkorb leer aktualisiert...</p>';
            if (subtotalEl) subtotalEl.textContent = '0.00 €';
            if (totalEl) totalEl.textContent = '0.00 €';
            return;
        }

        cart.forEach(item => {
            const price = parseFloat(item.price);
            const qty = parseInt(item.quantity);
            const itemTotal = price * qty;

            // Kleinunternehmer: No VAT calculation/display needed on line items
            subtotal += itemTotal;

            // Image Fallback
            const imgSrc = item.image ? item.image : 'https://via.placeholder.com/60';

            const div = document.createElement('div');
            div.className = 'flex justify-between items-start border-b border-white/10 pb-4 last:border-0 last:pb-0';
            div.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="relative">
                        <img src="${imgSrc}" class="w-16 h-16 rounded-lg object-cover bg-white/10" onerror="this.src='https://via.placeholder.com/60'">
                        <span class="absolute -top-2 -right-2 bg-orange-600 text-white text-xs font-bold px-2 py-1 rounded-full">${qty}</span>
                    </div>
                    <div>
                        <h4 class="font-bold text-white">${item.name}</h4>
                        <p class="text-sm text-stone-400">${price.toFixed(2)} € / Stk.</p>
                        ${item.customText ? `<p class="text-xs text-orange-300 mt-1 italic">"${item.customText}"</p>` : ''}
                        ${item.customFont && item.customFont !== 'Standard' ? `<p class="text-xs text-stone-500">Schrift: ${item.customFont}</p>` : ''}
                    </div>
                </div>
                <div class="text-right">
                    <span class="block font-bold text-white font-serif">${itemTotal.toFixed(2)} €</span>
                </div>
            `;
            container.appendChild(div);
        });

        // VAT Display Row if needed
        // We will include it in the breakdown

        // Shipping Calculation
        const shippingInputs = document.querySelectorAll('input[name="shipping"]');
        let shippingCost = 5.99; // Default

        const updateTotals = () => {
            const selected = document.querySelector('input[name="shipping"]:checked');
            if (selected && selected.value === 'pickup') {
                shippingCost = 0;
            } else {
                shippingCost = 5.99;
            }

            if (shippingEl) shippingEl.textContent = shippingCost.toFixed(2) + ' €';
            if (subtotalEl) subtotalEl.textContent = subtotal.toFixed(2) + ' €';

            // Grand Total (No VAT added on top)
            const grandTotal = subtotal + shippingCost;

            const totalStr = grandTotal.toFixed(2) + ' €';
            if (totalEl) totalEl.textContent = totalStr;
            if (totalBreakdownEl) totalBreakdownEl.textContent = totalStr;
        };

        // Listen for changes
        shippingInputs.forEach(input => {
            input.addEventListener('change', updateTotals);
        });

        // Initial update
        updateTotals();
    }

    renderCartItems();

    // 2. Toggle Shipping Form
    const diffCheck = document.getElementById('diffShipping');
    const shippingSection = document.getElementById('shippingSection');

    if (diffCheck) {
        diffCheck.addEventListener('change', (e) => {
            if (e.target.checked) {
                shippingSection.classList.remove('hidden');
                document.querySelectorAll('[name^="shipping_"]').forEach(el => el.required = true);
            } else {
                shippingSection.classList.add('hidden');
                document.querySelectorAll('[name^="shipping_"]').forEach(el => el.required = false);
            }
        });
    }

    // Helper function to show error messages
    const showError = (message) => {
        errorMsg.textContent = message;
        errorMsg.classList.remove('hidden');
    };

    // 3. Submit Handler
    const form = document.getElementById('checkoutForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);

            let shipping = undefined;
            if (diffCheck && diffCheck.checked) {
                shipping = {
                    name: formData.get('shipping_name'),
                    street: formData.get('shipping_street'),
                    zip: formData.get('shipping_zip'),
                    city: formData.get('shipping_city'),
                    country: 'Deutschland'
                };
            }

            const billing = {
                name: formData.get('billing_name'),
                street: formData.get('billing_street'),
                zip: formData.get('billing_zip'),
                city: formData.get('billing_city'),
                country: 'Deutschland'
            };

            // Reload cart to be sure
            const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');

            const payload = {
                items: currentCart.map(i => ({
                    productId: i.id,
                    quantity: i.quantity,
                    customText: i.customText || '',
                    customFont: i.customFont || 'Standard'
                })),
                billing,
                shipping,
                email: formData.get('email'),
                paymentMethod: 'PayPal',
                shippingMethod: document.querySelector('input[name="shipping"]:checked').value,
                website: formData.get('website')
            };

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Verarbeite...';

                const res = await fetch('/api/shop/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await res.json();

                if (res.ok) {
                    localStorage.removeItem('cart');
                    window.location.href = '/thank-you.html';
                } else {
                    throw new Error(result.error || 'Ein unbekannter Fehler ist aufgetreten.');
                }

            } catch (error) {
                console.error(error);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Kostenpflichtig bestellen';
                showError(error.message);
            }
        });
    }
});
