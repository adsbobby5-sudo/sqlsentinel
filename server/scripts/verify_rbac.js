
console.log('Starting RBAC DDL verification...');

async function test() {
    try {
        const BASE_URL = 'http://localhost:3000';

        async function login(email, password) {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!res.ok) throw new Error(`Login failed for ${email}`);
            return await res.json();
        }

        async function executeQuery(token, sql, connectionId) {
            const res = await fetch(`${BASE_URL}/api/query/execute`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ sql, connectionId })
            });
            const data = await res.json();
            return { status: res.status, data };
        }

        // 1. Login as Admin to get a connection ID
        const adminData = await login('admin@sqlsentinel.local', 'admin123');
        const adminToken = adminData.token;

        const connsRes = await fetch(`${BASE_URL}/api/connections`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const conns = await connsRes.json();
        if (conns.length === 0) throw new Error('No connections found');
        const connectionId = conns[0].id;
        console.log(`Using Connection ID: ${connectionId}`);

        // 2. Test Developer - Should be BLOCKED
        console.log('Testing Developer (Should fail)...');
        // Ensure developer exists (we assume testdev exists from previous steps)
        const devData = await login('testdev@sqlsentinel.local', 'password123');

        const devRes = await executeQuery(devData.token, 'CREATE TABLE dev_hack (id INT)', connectionId);
        console.log(`Developer Result: ${devRes.status}`); // Expect 403

        if (devRes.status !== 403) {
            console.error('FAILED: Developer was NOT blocked from CREATE TABLE!');
            console.log(JSON.stringify(devRes.data));
            // process.exit(1); // Continue to check admin ?
        } else {
            console.log('PASSED: Developer blocked.');
        }

        // 3. Test Admin - Should be ALLOWED
        console.log('Testing Admin (Should succeed)...');
        // Admin token is already available
        const adminRes = await executeQuery(adminToken, 'CREATE TABLE admin_test_table (id INT)', connectionId);
        console.log(`Admin Result: ${adminRes.status}`);

        if (adminRes.status === 200) {
            console.log('PASSED: Admin allowed.');
        } else {
            console.log('Admin failed (could be DB error, but lets check if it was 403):');
            console.log(JSON.stringify(adminRes.data));
            if (adminRes.status === 403) {
                console.error('FAILED: Admin was blocked!');
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
