'use strict';
const fs = require('node:fs');
const path = require('node:path');

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/dashboard', ['index.html', 'text/html; charset=utf-8']],
  ['/dashboard/', ['index.html', 'text/html; charset=utf-8']],
  ['/dashboard/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/dashboard/styles.css', ['styles.css', 'text/css; charset=utf-8']]
]);
function serveDashboard(req, res, pathname) {
  if (req.method !== 'GET' || !assets.has(pathname)) return false;
  const [file, type] = assets.get(pathname);
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
  });
  res.end(fs.readFileSync(path.join(__dirname, '../dashboard', file)));
  return true;
}
function permittedOrigin(origin, config) {
  if (!origin) return true; // CLI and extension-host requests do not send Origin.
  const port = config.port || 4318;
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(origin);
}
module.exports = {serveDashboard, permittedOrigin};
