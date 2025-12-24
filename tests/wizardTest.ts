import { describe, it } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';
let cookie = '';
let productId = 0;

async function testWizardLogic() {
    console.log('\n--- Testing Advanced Wizard Logic ---');

    // 1. Login
    console.log('1. Logging in...');
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'securePassword123!' })
    });

    if (!loginRes.ok) process.exit(1);
    cookie = loginRes.headers.get('set-cookie')?.split(';')[0] || '';
    if (!cookie) { console.error('No cookie'); process.exit(1); }

    // 2. Create Product (Net + Tax)
    console.log('\n2. Creating Product (100 Net + 19% Tax)...');

    const formData = new FormData();
    formData.append('name', 'Tax Test Product');
    formData.append('price_net', '100');
    formData.append('tax_rate', '0.19');
    formData.append('stock', '5'); // Low Stock

    const createRes = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
            'Cookie': cookie
        },
        body: formData
    });

    if (createRes.ok) {
        const data = await createRes.json();
        productId = data.id;
        console.log(`✅ Product created. returned Gross Price: ${data.price_gross}`);
        if (data.price_gross == '119.00') {
            console.log('✅ Tax Calculation correct (119.00).');
        } else {
            console.error(`❌ Tax Calculation wrong: ${data.price_gross}`);
        }
    } else {
        const text = await createRes.text();
        console.error(`❌ Create failed: ${text}`);
        process.exit(1);
    }

    // 3. Check Stock Status
    console.log('\n3. Checking Stock Status...');
    const listRes = await fetch(`${BASE_URL}/api/products`);
    const products = await listRes.json();
    const product = products.find((p: any) => p.id === productId);

    if (product) {
        if (product.stock_status === 'LOW') {
            console.log('✅ Stock Status is LOW (Stock: 5).');
        } else {
            console.error(`❌ Stock Status wrong: ${product.stock_status}`);
        }
    } else {
        console.error('❌ Product not found.');
    }

    // 4. Update Stock
    console.log('\n4. Updating Stock to 20...');
    // Note: PUT needs to handle JSON or FormData? 
    // Usually PUT for updates is JSON, but if we used Wizard for Edit, it would be FormData.
    // Our backend route for PUT currently expects body parsed by bodyParser.json() which is standard. 
    // But wait, the route expects `productSchema.partial()`.
    // The previous implementation used JSON body.
    // Let's see if we broke PUT. 
    // PUT route uses `req.body`. If I send JSON, `body-parser` handles it.
    // The validation schema expects typical fields.

    const updateRes = await fetch(`${BASE_URL}/api/products/${productId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({
            stock: 20
        })
    });

    if (updateRes.ok) {
        const checkRes = await fetch(`${BASE_URL}/api/products/${productId}`);
        const checked = await checkRes.json();
        if (checked.stock_status === 'OK') {
            console.log('✅ Stock Status is OK (Stock: 20).');
        } else {
            console.error(`❌ Stock Status wrong: ${checked.stock_status}`);
        }
    } else {
        console.error(`❌ Update failed: ${updateRes.status}`);
    }

    // Cleanup
    await fetch(`${BASE_URL}/api/products/${productId}`, {
        method: 'DELETE',
        headers: { 'Cookie': cookie }
    });
}

testWizardLogic();
