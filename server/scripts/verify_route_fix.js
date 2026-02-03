
console.log('Starting verification...');

async function test() {
    try {
        // 1. Login
        const loginRes = await fetch('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@sqlsentinel.local', password: 'admin123' })
        });

        if (!loginRes.ok) {
            const txt = await loginRes.text();
            console.error('Login failed:', txt);
            process.exit(1);
        }

        const loginData = await loginRes.json();
        const token = loginData.token;
        const userId = loginData.user.id;
        console.log('Logged in as user ID:', userId);

        // 2. Test GET /api/connections/user/:userId
        const url = `http://localhost:3000/api/connections/user/${userId}`;
        console.log('Testing endpoint:', url);

        const routeRes = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        console.log('Route Status:', routeRes.status);
        if (routeRes.status === 404) {
            console.error('Route NOT FOUND - validation failed.');
            process.exit(1);
        }

        const data = await routeRes.json();
        console.log('Route Response:', JSON.stringify(data, null, 2));

    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

test();
