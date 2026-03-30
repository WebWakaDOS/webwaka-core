import { createServer } from 'http';
import { readFileSync } from 'fs';

const port = 5000;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>@webwaka/core</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 60px auto; padding: 0 20px; background: #0f172a; color: #e2e8f0; }
    h1 { color: #38bdf8; }
    h2 { color: #7dd3fc; border-bottom: 1px solid #1e3a5f; padding-bottom: 8px; }
    code { background: #1e293b; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    pre { background: #1e293b; padding: 16px; border-radius: 8px; overflow-x: auto; }
    .badge { display: inline-block; background: #166534; color: #bbf7d0; padding: 2px 10px; border-radius: 12px; font-size: 0.85em; margin-left: 8px; }
    ul { line-height: 1.8; }
  </style>
</head>
<body>
  <h1>@webwaka/core <span class="badge">v1.0.0</span></h1>
  <p>WebWaka OS v4 — Shared platform primitives for building SaaS applications on the Cloudflare Workers ecosystem.</p>

  <h2>Modules</h2>
  <ul>
    <li><code>@webwaka/core/auth</code> — JWT auth, tenant resolution, CORS, rate-limiting middleware</li>
    <li><code>@webwaka/core/rbac</code> — Role-based access control</li>
    <li><code>@webwaka/core/billing</code> — Platform billing ledger (integer kobo values)</li>
    <li><code>@webwaka/core/logger</code> — Centralized platform logger</li>
    <li><code>@webwaka/core</code> — AI abstraction engine, notifications, geolocation, and more</li>
  </ul>

  <h2>Build Status</h2>
  <p>Library compiled successfully to <code>dist/</code>. Ready to be consumed by Cloudflare Workers services.</p>

  <h2>Usage</h2>
  <pre>import { logger } from '@webwaka/core/logger';
import { BillingLedger } from '@webwaka/core/billing';
import { createAuthMiddleware } from '@webwaka/core/auth';</pre>
</body>
</html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`@webwaka/core dev server running at http://0.0.0.0:${port}`);
});
