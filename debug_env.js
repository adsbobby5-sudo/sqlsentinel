import dotenv from 'dotenv';

console.log("--- Testing Environment Loading Logic ---");
// Simulate server.js loading
dotenv.config();
console.log("After .env load - API_KEY present:", !!process.env.API_KEY);

dotenv.config({ path: '.env.local', override: true });
console.log("After .env.local load - API_KEY present:", !!process.env.API_KEY);

if (process.env.API_KEY) {
    console.log("Final API_KEY length:", process.env.API_KEY.length);
}
