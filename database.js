const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'data.json');

/**
 * Load the database from disk
 */
function loadData() {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[DB] Error loading database:', error);
  }
  return { tokens: [] };
}

/**
 * Save the database to disk
 */
function saveData(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('[DB] Error saving database:', error);
  }
}

/**
 * Save a new token
 */
function saveToken(token, email, allowedRequests, expiresAt) {
  const data = loadData();
  data.tokens.push({
    token,
    email,
    allowed_requests: allowedRequests,
    used_requests: 0,
    created_at: new Date().toISOString(),
    expires_at: expiresAt
  });
  saveData(data);
}

/**
 * Get token information
 */
function getToken(token) {
  const data = loadData();
  const tokenData = data.tokens.find(t => t.token === token);
  
  // Basic expiration check
  if (tokenData && new Date(tokenData.expires_at) < new Date()) {
    return null;
  }
  
  return tokenData;
}

/**
 * Increment request usage for a token
 */
function incrementUsage(token) {
  const data = loadData();
  const index = data.tokens.findIndex(t => t.token === token);
  if (index !== -1) {
    data.tokens[index].used_requests += 1;
    saveData(data);
  }
}

/**
 * Cleanup expired tokens
 */
function cleanupExpired() {
  const data = loadData();
  const now = new Date();
  data.tokens = data.tokens.filter(t => new Date(t.expires_at) > now);
  saveData(data);
}

/**
 * Get all tokens
 */
function getAllTokens() {
  const data = loadData();
  return data.tokens;
}

module.exports = {
  saveToken,
  getToken,
  getAllTokens,
  incrementUsage,
  cleanupExpired
};
