
console.log('Starting full flow verification...');

async function test() {
    try {
        const BASE_URL = 'http://localhost:3000';

        // Helper to login
        async function login(email, password) {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!res.ok) throw new Error(`Login failed for ${email}: ${await res.text()}`);
            return await res.json();
        }

        // Helper to fetch connections
        async function getConnections(token) {
            const res = await fetch(`${BASE_URL}/api/connections`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`Get connections failed: ${await res.text()}`);
            return await res.json();
        }

        // 1. Login as Admin
        console.log('1. Logging in as Admin...');
        const adminData = await login('admin@sqlsentinel.local', 'admin123');
        const adminToken = adminData.token;
        console.log('   Admin logged in.');

        // 2. Identify Test Developer (or use one created)
        // We'll search for 'testdev' or create if not exists?
        // Let's assume 'testdev' was created by browser agent. 
        // If not, we'll try to find user id from admin list.
        const usersRes = await fetch(`${BASE_URL}/api/admin/users`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const users = await usersRes.json();
        let devUser = users.find(u => u.email === 'testdev@sqlsentinel.local');

        if (!devUser) {
            console.error('User testdev not found. Verification cannot proceed without user.');
            process.exit(1);
        }
        console.log(`   Found dev user: ${devUser.email} (ID: ${devUser.id})`);

        // 3. Login as Developer to check initial state
        // Note: Password might be 'password123' set by browser agent
        console.log('2. Logging in as Developer...');
        const devData = await login('testdev@sqlsentinel.local', 'password123');
        const devToken = devData.token;
        console.log('   Developer logged in.');

        let devConns = await getConnections(devToken);
        console.log(`   Developer currently sees ${devConns.length} connections: ${devConns.map(c => c.name).join(', ')}`);

        // 4. Assign Database (if not already assigned)
        // Helper to find connection 'my_sit'
        const allConnsRes = await fetch(`${BASE_URL}/api/connections`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const allConns = await allConnsRes.json();
        const db = allConns.find(c => c.name === 'my_sit') || allConns[0]; // Fallback to first one
        if (!db) {
            console.error('No databases found in system to assign.');
            process.exit(1);
        }
        console.log(`   Target database: ${db.name} (ID: ${db.id})`);

        console.log('3. Assigning database to Developer...');
        // Grant access
        const grantRes = await fetch(`${BASE_URL}/api/connections/${db.id}/grant/${devUser.id}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (grantRes.ok) console.log('   Access granted.');
        else console.log('   Access grant failed or already exists:', await grantRes.text());

        // 5. Verify Developer Access
        console.log('4. Verifying Developer Access...');
        devConns = await getConnections(devToken);
        const hasAccess = devConns.some(c => c.id === db.id);
        console.log(`   Developer sees database? ${hasAccess}`);
        if (!hasAccess) {
            console.error('FAILED: Developer should see the database.');
            process.exit(1);
        }

        // 6. Revoke Access
        console.log('5. Revoking Access...');
        const revokeRes = await fetch(`${BASE_URL}/api/connections/${db.id}/grant/${devUser.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        if (revokeRes.ok) console.log('   Access revoked.');
        else console.error('   Revoke failed:', await revokeRes.text());

        // 7. Verify Revocation
        console.log('6. Verifying Revocation...');
        devConns = await getConnections(devToken);
        const stillHasAccess = devConns.some(c => c.id === db.id);
        console.log(`   Developer sees database? ${stillHasAccess}`);

        if (stillHasAccess) {
            console.error('FAILED: Developer executed SHOULD NOT see the database.');
            process.exit(1);
        }

        console.log('SUCCESS: Full flow verified!');

    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
}

test();
