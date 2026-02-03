import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment (must be 32 bytes for AES-256)
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        console.warn('⚠️  ENCRYPTION_KEY not set, using default (CHANGE IN PRODUCTION)');
        return crypto.scryptSync('default-insecure-key', 'salt', 32);
    }
    // If hex string, convert to buffer
    if (key.length === 64) {
        return Buffer.from(key, 'hex');
    }
    // Otherwise derive key from passphrase
    return crypto.scryptSync(key, 'sql-sentinel-salt', 32);
}

/**
 * Encrypt a plaintext string
 * @param {string} plaintext - Text to encrypt
 * @returns {string} - Base64 encoded encrypted string (iv:authTag:ciphertext)
 */
export function encrypt(plaintext) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine iv + authTag + ciphertext
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param {string} encryptedData - Base64 encoded encrypted string
 * @returns {string} - Decrypted plaintext
 */
export function decrypt(encryptedData) {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');

    if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Generate a secure random encryption key
 * @returns {string} - 64-char hex string (32 bytes)
 */
export function generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
}
