import { describe, it } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';
let cookie = '';
let productId = 0;

async function testProductCRUD() {
    console.log('\n--- Testing Product CRUD ---');

    // 1. Login
    console.log('1. Logging in...');
    const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'securePassword123!' })
    });

    if (!loginRes.ok) {
        console.error('❌ Login failed');
        process.exit(1);
    }
    const setCookie = loginRes.headers.get('set-cookie');
    if (setCookie) {
        cookie = setCookie.split(';')[0];
        console.log('✅ Logged in.');
    } else {
        console.error('❌ No cookie received');
        process.exit(1);
    }

    // 2. Create Product
    console.log('\n2. Creating Product...');
    const createRes = await fetch(`${BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({
            name: 'Test Product',
            price: 19.99,
            stock: 10,
            category: 'Testing'
        })
    });

    if (createRes.status === 201) {
        const data = await createRes.json();
        productId = data.id;
        console.log(`✅ Product created with ID: ${productId}`);
    } else {
        console.error(`❌ Failed to create product: ${createRes.status}`);
        const text = await createRes.text();
        console.error(text);
        process.exit(1);
    }

    // 3. Read Products
    console.log('\n3. Reading Products...');
    const listRes = await fetch(`${BASE_URL}/api/products`);
    const products = await listRes.json();
    const found = products.find((p: any) => p.id === productId);
    if (found) {
        console.log('✅ Created product found in list.');
    } else {
        console.error('❌ Created product NOT found in list.');
        process.exit(1);
    }

    // 4. Update Product
    console.log('\n4. Updating Product...');
    const updateRes = await fetch(`${BASE_URL}/api/products/${productId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookie
        },
        body: JSON.stringify({
            price: 29.99,
            name: 'Updated Product Name'
        })
    });

    if (updateRes.ok) {
        // Verify update
        const getRes = await fetch(`${BASE_URL}/api/products/${productId}`);
        const updatedProduct = await getRes.json();
        if (updatedProduct.price === 29.99 && updatedProduct.name === 'Updated Product Name') {
            console.log('✅ Product updated successfully.');
        } else {
            console.error('❌ Product update verification failed.');
        }
    } else {
        console.error(`❌ Failed to update product: ${updateRes.status}`);
    }

    // 5. Delete Product
    console.log('\n5. Deleting Product...');
    const deleteRes = await fetch(`${BASE_URL}/api/products/${productId}`, {
        method: 'DELETE',
        headers: {
            'Cookie': cookie
        }
    });

    if (deleteRes.ok) {
        console.log('✅ Product deleted.');
        // Verify deletion
        const getRes = await fetch(`${BASE_URL}/api/products/${productId}`);
        if (getRes.status === 404) {
            console.log('✅ Product correctly gone (404).');
        } else {
            console.error('❌ Product still exists after delete.');
        }
    } else {
        console.error(`❌ Failed to delete product: ${deleteRes.status}`);
    }
}

testProductCRUD();
