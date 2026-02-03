import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Get encryption key from environment (must be 32 bytes for AES-256)
function getEncryptionKey() {
    const key = process.env.APP_SECRET_KEY || 'default-secret-key-change-in-production';
    // Create a 32-byte key using SHA-256 hash
    return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted string (iv:tag:ciphertext in base64)
 */
export function encrypt(text) {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const tag = cipher.getAuthTag();

    // Return iv:tag:ciphertext
    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a string encrypted with AES-256-GCM
 * @param {string} encryptedText - Encrypted string (iv:tag:ciphertext)
 * @returns {string} - Decrypted plain text
 */
export function decrypt(encryptedText) {
    const key = getEncryptionKey();
    const [ivBase64, tagBase64, ciphertext] = encryptedText.split(':');

    const iv = Buffer.from(ivBase64, 'base64');
    const tag = Buffer.from(tagBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
