const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const key = Buffer.from(config.encryption.key, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, encrypted].map((b) => b.toString('hex')).join(':');
}

function decrypt(ciphertext) {
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(':');
  const key = Buffer.from(config.encryption.key, 'hex');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  return (
    decipher.update(Buffer.from(encryptedHex, 'hex'), undefined, 'utf8') +
    decipher.final('utf8')
  );
}

function hashApiKey(rawKey) {
  return crypto
    .createHmac('sha256', config.auth.apiKeySalt)
    .update(rawKey)
    .digest('hex');
}

function generateApiKey() {
  return `ak_live_${crypto.randomBytes(24).toString('hex')}`;
}

module.exports = { encrypt, decrypt, hashApiKey, generateApiKey };
