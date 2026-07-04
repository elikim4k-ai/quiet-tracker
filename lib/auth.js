// Shared-password auth. Works in both Edge (middleware) and Node runtimes via Web Crypto.
const SALT = 'quiet-tracker::v1::';

export async function authToken(password) {
  const bytes = new TextEncoder().encode(SALT + password);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const COOKIE_NAME = 'qt_auth';
