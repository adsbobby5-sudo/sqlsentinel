import bcrypt from 'bcrypt';
import fs from 'fs';

const password = 'admin123';
const hash = await bcrypt.hash(password, 12);
const matches = await bcrypt.compare(password, hash);

const output = `Hash: ${hash}
Length: ${hash.length}
Matches: ${matches}
Base64: ${Buffer.from(hash).toString('base64')}`;

fs.writeFileSync('hash_result.txt', output);
console.log('Done - check hash_result.txt');
