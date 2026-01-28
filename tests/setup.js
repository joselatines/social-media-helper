// Test setup file
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.test if it exists, otherwise from .env
const envPath = path.resolve(__dirname, '../.env.test');
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: envPath });
}

// Set default test environment variables if not set
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@flexzin.com';
process.env.ADMIN_PASS = process.env.ADMIN_PASS || 'changeme123';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.PORT = process.env.PORT || '3001'; // Use different port for tests