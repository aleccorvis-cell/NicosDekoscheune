document.addEventListener('DOMContentLoaded', () => {
    const productList = document.getElementById('productList');
    const addProductBtn = document.getElementById('addProductBtn');
    const productModal = document.getElementById('productModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const wizardForm = document.getElementById('wizardForm');

    // Wizard Steps
    const steps = document.querySelectorAll('.wizard-step');
    const nextBtns = document.querySelectorAll('.btn-next');
    const prevBtns = document.querySelectorAll('.btn-prev');
    let currentStep = 0;

    // Load products on startup
    loadProducts();

    // Event Listeners
    addProductBtn.addEventListener('click', openModal);
    closeModalBtn.addEventListener('click', closeModal);
    wizardForm.addEventListener('submit', handleFormSubmit);

    // Wizard Navigation
    nextBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                if (currentStep === 4) { // Update Calculation on entering Step 5 (Tax)
                    updateTaxCalculation();
                }
                showStep(currentStep + 1);
            }
        });
    });

    prevBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            showStep(currentStep - 1);
        });
    });

    // Tax Calculation Logic (Step 5)
    const taxSelect = document.getElementById('taxRate');
    taxSelect.addEventListener('change', updateTaxCalculation);

    // Click outside modal to close
    window.addEventListener('click', (e) => {
        if (e.target === productModal) {
            closeModal();
        }
    });

    function showStep(stepIndex) {
        steps[currentStep].classList.add('hidden');
        steps[stepIndex].classList.remove('hidden');
        currentStep = stepIndex;
    }

    function validateStep(stepIndex) {
        const step = steps[stepIndex];
        const inputs = step.querySelectorAll('input, textarea, select');
        let valid = true;

        inputs.forEach(input => {
            if (input.hasAttribute('required') && !input.value) {
                valid = false;
                input.classList.add('border-red-500');
            } else {
                input.classList.remove('border-red-500');
            }
        });

        if (!valid) {
            alert('Bitte füllen Sie alle Pflichtfelder aus.');
        }

        return valid;
    }

    function updateTaxCalculation() {
        const priceNet = parseFloat(document.getElementById('priceNet').value) || 0;
        const taxRate = parseFloat(document.getElementById('taxRate').value);
        const taxAmount = priceNet * taxRate;
        const grossPrice = priceNet + taxAmount;

        document.getElementById('calcNet').textContent = priceNet.toFixed(2) + ' €';
        document.getElementById('calcTax').textContent = taxAmount.toFixed(2) + ' €';
        document.getElementById('calcGross').textContent = grossPrice.toFixed(2) + ' €';
    }

    async function loadProducts() {
        try {
            const response = await fetch('/api/products');
            const products = await response.json();
            renderProducts(products);
        } catch (error) {
            console.error('Fehler beim Laden der Produkte:', error);
            productList.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Fehler beim Laden der Produkte</td></tr>';
        }
    }

    function renderProducts(products) {
        if (products.length === 0) {
            productList.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Keine Produkte vorhanden</td></tr>';
            return;
        }

        productList.innerHTML = products.map(product => {
            const stockColor = product.stock_status === 'LOW' ? 'text-red-600 font-bold' : 'text-gray-500';

            return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                    ${product.image_url ? `<img src="${product.image_url}" class="h-10 w-10 rounded object-cover">` : '<div class="h-10 w-10 bg-gray-200 rounded"></div>'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${product.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.category || '-'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${product.price.toFixed(2)} €</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm ${stockColor}">${product.stock}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="deleteProduct(${product.id})" class="text-red-600 hover:text-red-900">Löschen</button>
                </td>
            </tr>
        `}).join('');
    }

    // Modal Logic
    function openModal() {
        productModal.classList.remove('hidden');
        productModal.classList.add('flex');
        showStep(0); // Always start at step 1
    }

    function closeModal() {
        productModal.classList.add('hidden');
        productModal.classList.remove('flex');
        wizardForm.reset();
        steps.forEach(s => s.classList.add('hidden'));
        steps[0].classList.remove('hidden');
        currentStep = 0;
    }

    async function handleFormSubmit(e) {
        e.preventDefault();

        const formData = new FormData(wizardForm);

        // Mapping form names: 'priceNet' -> 'price_net'
        formData.append('price_net', document.getElementById('priceNet').value);

        // Log FormData for debugging
        for (var pair of formData.entries()) {
            console.log(pair[0] + ', ' + pair[1]);
        }

        try {
            const response = await fetch('/api/products', {
                method: 'POST',
                body: formData // No Content-Type header needed, browser sets it for multipart
            });

            if (response.ok) {
                closeModal();
                loadProducts();
            } else {
                const result = await response.json();
                alert('Fehler: ' + (result.error || 'Unbekannt') + ' ' + JSON.stringify(result.details || ''));
            }
        } catch (error) {
            console.error('Create error:', error);
            alert('Netzwerkfehler beim Erstellen');
        }
    }

    // Expose delete
    window.deleteProduct = async (id) => {
        if (!confirm('Produkt wirklich löschen?')) return;
        try {
            const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (response.ok) loadProducts();
        } catch (e) { console.error(e); }
    };
});
