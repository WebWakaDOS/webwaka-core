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
  <h1>@webwaka/core <span class="badge">v1.3.0</span></h1>
  <p>WebWaka OS v4 — Shared platform primitives for building SaaS applications on the Cloudflare Workers ecosystem.</p>

  <h2>Core Modules</h2>
  <ul>
    <li><code>@webwaka/core/auth</code> — JWT auth, tenant resolution, CORS, rate-limiting middleware</li>
    <li><code>@webwaka/core/rbac</code> — Role-based access control</li>
    <li><code>@webwaka/core/billing</code> — Platform billing ledger (integer kobo values)</li>
    <li><code>@webwaka/core/logger</code> — Centralized platform logger</li>
    <li><code>@webwaka/core/ai</code> — AI abstraction engine (3-tier fallback)</li>
    <li><code>@webwaka/core/notifications</code> — Unified SMS/Email (Yournotify + Termii)</li>
    <li><code>@webwaka/core/kyc</code> — KYC/KYB verification engine</li>
    <li><code>@webwaka/core/events</code> — Event bus primitives</li>
  </ul>

  <h2>Phase P01 Primitives (v1.3.0)</h2>
  <ul>
    <li><code>TaxEngine</code> — VAT computation with exempt category support (kobo precision)</li>
    <li><code>IPaymentProvider / PaystackProvider</code> — Charge verify, refund, split, transfer</li>
    <li><code>ISmsProvider / TermiiProvider</code> — OTP via WhatsApp with SMS auto-fallback</li>
    <li><code>checkRateLimit()</code> — KV-backed rate limiter (standalone, no Hono required)</li>
    <li><code>updateWithVersionLock()</code> — D1 optimistic concurrency control</li>
    <li><code>hashPin() / verifyPin()</code> — PBKDF2 PIN hashing via Web Crypto API</li>
    <li><code>IKycProvider</code> — BVN / NIN / CAC verification interface</li>
    <li><code>OpenRouterClient</code> — Vendor-neutral AI completions via OpenRouter</li>
    <li><code>CommerceEvents</code> — Commerce event type constants registry</li>
  </ul>

  <h2>Build Status</h2>
  <p>Library type-checks clean. Ready to be consumed by Cloudflare Workers services.</p>

  <h2>Usage</h2>
  <pre>import { TaxEngine, createTaxEngine } from '@webwaka/core';
import { IPaymentProvider, createPaymentProvider } from '@webwaka/core';
import { checkRateLimit } from '@webwaka/core';
import { hashPin, verifyPin } from '@webwaka/core';
import { CommerceEvents } from '@webwaka/core';</pre>
</body>
</html>`;

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`@webwaka/core dev server running at http://0.0.0.0:${port}`);
});
