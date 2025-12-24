import { describe, it } from 'node:test';
import assert from 'node:assert';

const BASE_URL = 'http://localhost:3000';

// Helper to simulate sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testDashboardAccess() {
    console.log('\n--- Testing Dashboard Access ---');

    console.log('1. Testing Access without Cookie (Should Redirect/Fail)...');
    try {
        const res = await fetch(`${BASE_URL}/admin/dashboard`, {
            redirect: 'manual' // Don't follow redirects automatically to check for 302
        });

        console.log(`Status: ${res.status}`);
        if (res.status === 302) {
            console.log(`Location Header: ${res.headers.get('location')}`);
        }

        if (res.status === 302 && res.headers.get('location')?.includes('/admin/login')) {
            console.log('✅ Access denied, redirected to login correctly.');
        } else if (res.status === 401 || res.status === 403) {
            console.log('✅ Access denied (Status Code check).');
        } else {
            console.error('❌ Access NOT denied as expected:', res.status);
            process.exit(1);
        }

    } catch (e) {
        console.error('❌ Request failed:', e);
    }

    console.log('\n2. Testing Access with INVALID Cookie...');
    try {
        const res = await fetch(`${BASE_URL}/admin/dashboard`, {
            headers: {
                'Cookie': 'auth_token=invalid_token_garbage'
            },
            redirect: 'manual'
        });
        console.log(`Status: ${res.status}`);
        if (res.status === 302 && res.headers.get('location')?.includes('/admin/login')) {
            console.log('✅ Access denied with invalid token, redirected correctly.');
        } else {
            console.error('❌ Access not denied correctly for invalid token:', res.status);
            process.exit(1);
        }
    } catch (e) {
        console.error('❌ Request failed:', e);
    }

    console.log('\n3. Login to get valid cookie...');
    let cookie = '';
    try {
        const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'securePassword123!' })
        });

        if (!loginRes.ok) {
            throw new Error('Login failed during test setup');
        }

        const setCookie = loginRes.headers.get('set-cookie');
        if (setCookie) {
            cookie = setCookie.split(';')[0]; // simple parsing
            console.log('✅ Got Cookie:', cookie);
        } else {
            throw new Error('No cookie received from login');
        }

    } catch (e) {
        console.error('❌ Login failed:', e);
        process.exit(1);
    }

    console.log('\n4. Testing Access WITH Valid Cookie...');
    try {
        const res = await fetch(`${BASE_URL}/admin/dashboard`, {
            headers: {
                'Cookie': cookie
            },
            redirect: 'manual'
        });

        console.log(`Status: ${res.status}`);
        if (res.status === 200) {
            console.log('✅ Dashboard access successful.');
            const text = await res.text();
            if (text.includes('Admin Dashboard')) {
                console.log('✅ Dashboard content verified.');
            } else {
                console.error('❌ Dashboard content missing keywords.');
            }
        } else {
            console.error('❌ Failed to access dashboard with valid cookie:', res.status);
            process.exit(1);
        }

    } catch (e) {
        console.error('❌ Request failed:', e);
        process.exit(1);
    }
}

testDashboardAccess();
