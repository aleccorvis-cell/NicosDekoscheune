document.addEventListener('DOMContentLoaded', () => {
    // State
    let products = [];
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    let currentCategory = 'ALL';

    // DOM Elements
    // DOM Elements
    const productGrid = document.getElementById('productGrid');
    const categoryFilters = document.getElementById('categoryFilters');
    const cartBtn = document.getElementById('cartBtn');
    const cartCount = document.getElementById('cartCount');
    const cartBackdrop = document.getElementById('cartBackdrop');
    const cartSidebar = document.getElementById('cartSidebar');
    const closeCartBtn = document.getElementById('closeCartBtn');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartTotalElement = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const toast = document.getElementById('toast');

    // Init
    loadCategories();
    loadProducts();

    // Migration: Ensure all items have a cartId (String)
    let dirty = false;
    cart = cart.map(item => {
        if (!item.cartId) {
            item.cartId = 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            dirty = true;
        } else {
            // Ensure string
            if (typeof item.cartId !== 'string') {
                item.cartId = String(item.cartId);
                dirty = true;
            }
        }
        return item;
    });
    if (dirty) {
        localStorage.setItem('cart', JSON.stringify(cart));
    }

    updateCartUI();

    // --- Global Event Listeners (Delegation) ---

    // 1. Product Grid Clicks (Add to Cart)
    if (productGrid) {
        productGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.add-to-cart-btn');
            if (btn) {
                if (btn.disabled) return;
                const id = parseInt(btn.dataset.id, 10);
                // Find textarea and font selector in the same card
                const card = btn.closest('.glass-card');
                const textarea = card.querySelector('.custom-text-input');
                const fontSelect = card.querySelector('.font-selector');
                const customText = textarea ? textarea.value.trim() : '';
                const customFont = fontSelect ? fontSelect.value : 'Standard';

                addToCart(id, customText, customFont);
            }
        });
    }

    // 2. Cart Items Clicks (+/- / Remove)
    if (cartItemsContainer) {
        cartItemsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const action = btn.dataset.action;
            const cartId = btn.dataset.cartId; // Use cartId

            if (cartId) {
                if (action === 'increase') changeQty(cartId, 1);
                if (action === 'decrease') changeQty(cartId, -1);
                if (action === 'remove') removeItem(cartId);
            }
        });
    }

    // 3. UI Toggles
    if (cartBtn) cartBtn.addEventListener('click', openCart);
    if (closeCartBtn) closeCartBtn.addEventListener('click', closeCart);
    if (cartBackdrop) {
        cartBackdrop.addEventListener('click', closeCart);
    }
    if (checkoutBtn) checkoutBtn.addEventListener('click', handleCheckout);


    // --- Data Loading ---

    async function loadCategories() {
        try {
            const res = await fetch('/api/products/categories');
            const categories = await res.json();

            const container = document.getElementById('categoryFilter');
            // Hardcode 'Alle' first
            const allBtn = createFilterBtn('Alle', true);
            container.innerHTML = '';
            container.appendChild(allBtn);

            categories.forEach(cat => {
                container.appendChild(createFilterBtn(cat, false));
            });

        } catch (e) {
            console.error('Failed to load categories', e);
        }
    }

    function createFilterBtn(name, isActive) {
        const btn = document.createElement('button');
        btn.textContent = name;
        // Glass Button Styling
        if (isActive) {
            btn.className = 'glass-button min-w-[100px] transform scale-105 ring-2 ring-orange-400 ring-offset-2 ring-offset-stone-900';
        } else {
            btn.className = 'glass-button-secondary min-w-[100px] opacity-70 hover:opacity-100';
        }

        btn.onclick = () => {
            currentCategory = name === 'Alle' ? null : name;
            renderProducts(currentCategory ? products.filter(p => p.category === currentCategory) : products);

            // Update Active State Visuals
            Array.from(document.getElementById('categoryFilter').children).forEach(b => {
                b.className = 'glass-button-secondary min-w-[100px] opacity-70 hover:opacity-100';
            });
            btn.className = 'glass-button min-w-[100px] transform scale-105 ring-2 ring-orange-400 ring-offset-2 ring-offset-stone-900';
        };
        return btn;
    }

    async function loadProducts() {
        try {
            const res = await fetch('/api/products');
            products = await res.json();
            renderProducts(products); // Initial render with all products
        } catch (error) {
            productGrid.innerHTML = '<p class="text-center text-red-500 col-span-full">Fehler beim Laden der Produkte.</p>';
        }
    }

    function renderProducts(filteredProducts) {
        const grid = document.getElementById('productGrid');
        grid.innerHTML = '';

        if (filteredProducts.length === 0) {
            grid.innerHTML = '<div class="col-span-full text-center py-20 text-stone-400 text-xl font-light">Keine Exponate gefunden.</div>';
            return;
        }

        filteredProducts.forEach(product => {
            const el = document.createElement('div');
            // Glass Card Style
            el.className = 'glass-card group flex flex-col h-full relative overflow-hidden';

            // Stock Badge
            let stockBadge = '';
            if (product.stock === 0) {
                stockBadge = '<span class="absolute top-4 left-4 z-10 bg-stone-900/80 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10">AUSVERKAUFT</span>';
            } else if (product.stock <= 3) {
                stockBadge = '<span class="absolute top-4 left-4 z-10 bg-orange-600/90 backdrop-blur text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10 animate-pulse">FAST WEG!</span>';
            }

            // Image Area
            el.innerHTML = `
                ${stockBadge}
                <div class="relative w-full h-64 overflow-hidden rounded-t-2xl bg-white/5">
                    <img src="${product.image_url || 'https://via.placeholder.com/300'}" 
                         alt="${product.name}" 
                         class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                    <div class="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                
                <div class="p-6 flex flex-col flex-1">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="text-xl font-bold font-serif text-white group-hover:text-orange-400 transition-colors">${product.name}</h3>
                        <span class="text-sm px-2 py-1 rounded bg-white/10 text-stone-300 font-mono">${product.category}</span>
                    </div>
                    
                    <p class="text-stone-400 text-sm mb-6 flex-1 line-clamp-3 leading-relaxed">${product.description}</p>
                    
                    <div class="mb-4 space-y-3">
                        <div>
                            <label class="block text-xs text-stone-400 mb-1">✨ Personalisierungstext (optional):</label>
                            <textarea class="glass-input w-full text-sm resize-none h-16 custom-text-input" 
                                      placeholder="z.B. 'Familie Müller 2024' oder 'Für Oma mit ❤️'"
                                      data-product-id="${product.id}"></textarea>
                        </div>
                        <div>
                            <label class="block text-xs text-stone-400 mb-1">✍️ Schriftart:</label>
                            <select class="glass-input w-full text-sm font-selector" data-product-id="${product.id}">
                                <option value="Standard" style="font-family: sans-serif;">Standard (Sans-Serif)</option>
                                <option value="Schreibschrift" style="font-family: cursive;">Schreibschrift</option>
                                <option value="Klassisch" style="font-family: serif;">Klassisch (Serif)</option>
                                <option value="Handschrift" style="font-family: 'Comic Sans MS', cursive;">Handschrift</option>
                            </select>
                        </div>
                        <p class="text-[10px] text-orange-400/80 leading-tight">
                            Hinweis: Personalisierte Artikel sind vom Umtausch ausgeschlossen.
                        </p>
                    </div>

                    <div class="flex justify-between items-center pt-4 border-t border-white/10">
                        <span class="text-2xl font-bold text-white font-serif tracking-tight">${product.price.toFixed(2)} €</span>
                        
                        <!-- AGB-Compliant Button Label: "Bestellen" -->
                        <button data-id="${product.id}" 
                                ${product.stock === 0 ? 'disabled' : ''}
                                class="add-to-cart-btn glass-button-secondary hover:bg-orange-600 hover:border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 group/btn">
                            ${product.stock === 0 ? 'Ausverkauft' : 'Bestellen'}
                             ${product.stock > 0 ? '<svg class="w-4 h-4 transform group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>' : ''}
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(el);
        });
    }

    function setCategory(cat, btnClicked) {
        currentCategory = cat;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('bg-rustic-wood', 'text-white', 'shadow-sm');
            btn.classList.add('bg-white', 'text-stone-600');
        });
        if (cat === 'ALL') {
            const allBtn = document.querySelector('[data-category="ALL"]');
            allBtn.classList.add('bg-rustic-wood', 'text-white', 'shadow-sm');
            allBtn.classList.remove('bg-white', 'text-stone-600');
        } else {
            btnClicked.classList.add('bg-rustic-wood', 'text-white', 'shadow-sm');
            btnClicked.classList.remove('bg-white', 'text-stone-600');
        }
        const filtered = currentCategory === 'ALL'
            ? products
            : products.filter(p => p.category === currentCategory);
        renderProducts(filtered);
    }

    // --- Interaction Logic (Internal) ---

    function addToCart(id, customText = '', customFont = 'Standard') {
        const product = products.find(p => p.id === id);
        if (!product || product.stock <= 0) return;

        // Find existing item with SAME ID, SAME custom text AND SAME font
        const existing = cart.find(item => item.id === id && (item.customText || '') === customText && (item.customFont || 'Standard') === customFont);

        // Check total quantity for this product ID across all variants
        const allVariants = cart.filter(item => item.id === id);
        const totalQty = allVariants.reduce((sum, item) => sum + item.quantity, 0);

        if (totalQty + 1 > product.stock) {
            alert('Leider nicht mehr genügend auf Lager!');
            return;
        }

        if (existing) {
            existing.quantity++;
        } else {
            // Create unique ID for cart item to allow removing specific variant? 
            // We can just rely on item.id + customText, but for removal we need a composite key or index.
            // Let's add a temporary unique 'cartId'
            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image_url,
                quantity: 1,
                customText: customText,
                customFont: customFont,
                cartId: 'id_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
            });
        }

        saveCart();
        showToast();
        openCart();
    }

    // --- Cart Logic (UI Update) ---
    function updateCartUI() {
        renderCart();
    }

    function renderCart() {
        const container = cartItemsContainer; // Use the global variable
        const countBadge = document.getElementById('cartCount');
        const totalEl = document.getElementById('cartTotal');

        if (!container) return;

        container.innerHTML = '';
        let total = 0;
        let count = 0;

        if (cart.length === 0) {
            container.innerHTML = '<p class="text-center text-stone-500 mt-10 italic">Ihr Korb ist noch leer.</p>';
        }

        cart.forEach(item => {
            total += item.price * item.quantity;
            count += item.quantity;

            const div = document.createElement('div');
            // Cart Item: Glass-like container
            div.className = 'flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5 mb-2';
            div.innerHTML = `
                <div class="w-16 h-16 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                    <img src="${item.image}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-white truncate">${item.name}</h4>
                    <p class="text-sm text-stone-400 font-mono">${item.price.toFixed(2)} €</p>
                    ${item.customText ? `<p class="text-xs text-orange-300 mt-1 italic">"${item.customText}"</p>` : ''}
                    ${item.customFont && item.customFont !== 'Standard' ? `<p class="text-xs text-stone-500">Schrift: ${item.customFont}</p>` : ''}
                    
                    <div class="flex items-center gap-2 mt-2">
                        <button data-action="decrease" data-cart-id="${item.cartId}" class="w-6 h-6 rounded bg-white/10 text-white hover:bg-white/20 flex items-center justify-center">-</button>
                        <span class="text-sm font-medium w-6 text-center text-white">${item.quantity}</span>
                        <button data-action="increase" data-cart-id="${item.cartId}" class="w-6 h-6 rounded bg-white/10 text-white hover:bg-white/20 flex items-center justify-center">+</button>
                    </div>
                </div>
                <button data-action="remove" data-cart-id="${item.cartId}" class="text-stone-500 hover:text-red-400 p-2 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            `;
            container.appendChild(div);
        });

        // Update Total & Badge
        if (totalEl) totalEl.textContent = total.toFixed(2) + ' €';
        if (countBadge) {
            countBadge.textContent = count;
            countBadge.parentElement.classList.toggle('animate-bounce', count > 0);
        }

        // Ensure checkout button is enabled/disabled?
        // Logic handled in click handler usually, but here checking existing cart.
    }

    // 2. Cart Items Clicks (+/- / Remove) (Updated for cartId)
    // Note: The event listener above needs to look for data-cart-id if present

    function changeQty(cartId, delta) {
        // String ID from dataset
        const item = cart.find(i => i.cartId === cartId);
        if (!item) return;

        const product = products.find(p => p.id === item.id);

        // Check total stock for this product type again
        if (delta > 0) {
            const allVariants = cart.filter(i => i.id === item.id);
            const totalQty = allVariants.reduce((sum, i) => sum + i.quantity, 0);
            if (product && totalQty + 1 > product.stock) {
                alert('Maximaler Bestand erreicht!');
                return;
            }
        }

        item.quantity += delta;
        if (item.quantity <= 0) removeItem(cartId);
        else saveCart();
    }

    function removeItem(cartId) {
        cart = cart.filter(i => i.cartId !== cartId);
        saveCart();
    }

    function saveCart() {
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartUI();
    }

    // --- Overlay UI ---
    function openCart() {
        if (cartSidebar) cartSidebar.classList.remove('translate-x-full');
    }

    function closeCart() {
        if (cartSidebar) cartSidebar.classList.add('translate-x-full');
    }

    function showToast() {
        toast.classList.remove('translate-y-20');
        setTimeout(() => { toast.classList.add('translate-y-20'); }, 3000);
    }

    async function handleCheckout() {
        if (cart.length === 0) return;
        window.location.href = '/checkout.html';
    }
});
