const jwt = require('jsonwebtoken');
const config = require('../../config');
const { hashApiKey } = require('../../utils/crypto');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(config.db.supabaseUrl, config.db.supabaseServiceKey);

async function requireApiKey(req, res, next) {
  const header = req.headers['authorization'] || '';
  const raw = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!raw || !raw.startsWith('ak_')) {
    return res.status(401).json({ error: 'missing_api_key', message: 'Provide a valid API key in the Authorization header.' });
  }

  const hashed = hashApiKey(raw);

  const { data: keyRecord, error } = await supabase
    .from('api_keys')
    .select('id, merchant_id, scopes, revoked_at')
    .eq('key_hash', hashed)
    .single();

  if (error || !keyRecord) {
    return res.status(401).json({ error: 'invalid_api_key', message: 'The API key provided is not valid.' });
  }

  if (keyRecord.revoked_at) {
    return res.status(401).json({ error: 'revoked_api_key', message: 'This API key has been revoked.' });
  }

  req.merchant = { id: keyRecord.merchant_id, scopes: keyRecord.scopes };
  next();
}

function requireScope(scope) {
  return (req, res, next) => {
    if (!req.merchant?.scopes?.includes(scope)) {
      return res.status(403).json({
        error: 'insufficient_scope',
        message: `This key does not have the '${scope}' permission.`,
      });
    }
    next();
  };
}

function requireJwt(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'missing_token' });
  }

  try {
    req.user = jwt.verify(token, config.auth.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token', message: 'Token is expired or malformed.' });
  }
}

module.exports = { requireApiKey, requireScope, requireJwt };
