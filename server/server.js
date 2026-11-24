'use strict';
// 仁義サンシャイン game server: serves the game, keeps saves and purchases,
// and takes card payments through Stripe Checkout. No npm dependencies
// (Node 22.13+ for node:sqlite).
// The same server also handles saves and payments for 仁義 中洲ナイト, which is
// hosted elsewhere (Cloudflare Pages) and calls this API across origins (CORS).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const PRODUCTS_JINGI = require('./products');
const PRODUCTS_NAKASU = require('./products-nakasu');

// ---------- config ----------
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile(path.join(__dirname, '.env'));
const PORT = Number(process.env.PORT || 8787);
const CFG = {
  port: PORT,
  // RENDER_EXTERNAL_URL is set automatically on Render
  publicUrl: (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, ''),
  mode: process.env.PAYMENT_MODE || 'mock', // 'stripe' | 'mock'
  stripeKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  // Pinned so Stripe API changes never reach production unannounced. Bump deliberately.
  stripeVersion: process.env.STRIPE_API_VERSION || '2026-11-18.endive',
  // Product tax code (needed for Managed Payments / Stripe Tax). Browser game, consumable in-game items.
  taxCode: process.env.STRIPE_TAX_CODE || 'txcd_10201003',
  // 'off' sends managed_payments[enabled]=false; otherwise the account's default applies.
  managedPayments: process.env.STRIPE_MANAGED_PAYMENTS || 'default',
  monthlyLimit: Number(process.env.MONTHLY_LIMIT_JPY || 10000),
  dbPath: process.env.DB_PATH || path.join(__dirname, 'data', 'game.db'),
  trustProxy: process.env.TRUST_PROXY === '1',
  gameFile: process.env.GAME_FILE || path.join(__dirname, '..', 'index.html'),
};
const originOf = u => { try { return new URL(u).origin; } catch { return ''; } };
// Games served by this API. Each user (device token) belongs to one game.
const GAMES = {
  jingi: { name: '仁義サンシャイン', products: PRODUCTS_JINGI, url: CFG.publicUrl + '/', monthlyLimit: CFG.monthlyLimit },
  nakasu: { name: '仁義 中洲ナイト', products: PRODUCTS_NAKASU, url: process.env.NAKASU_URL || '',
    monthlyLimit: Number(process.env.NAKASU_MONTHLY_LIMIT_JPY || 50000) },
};
const PRODUCTS = Object.values(GAMES).flatMap(g => g.products);
if (new Set(PRODUCTS.map(p => p.id)).size !== PRODUCTS.length) throw new Error('product ids must be unique across games');
const gameOf = u => GAMES[u.game] || GAMES.jingi;
// Browsers allowed to call the API from another origin (the 中洲ナイト site, plus CORS_ORIGINS for previews).
const CORS_ORIGINS = new Set([originOf(GAMES.nakasu.url), ...(process.env.CORS_ORIGINS || '').split(',').map(s => originOf(s.trim()))].filter(Boolean));
// Seller details for the legal pages (特定商取引法). Kept in env vars, not in the repo.
const SELLER = {
  SELLER_NAME: process.env.SELLER_NAME || '',
  SELLER_REPRESENTATIVE: process.env.SELLER_REPRESENTATIVE || process.env.SELLER_NAME || '',
  SELLER_ADDRESS: process.env.SELLER_ADDRESS || '請求があった場合には遅滞なく開示します',
  SELLER_PHONE: process.env.SELLER_PHONE || '請求があった場合には遅滞なく開示します',
  SELLER_EMAIL: process.env.SELLER_EMAIL || '',
  LEGAL_EFFECTIVE_DATE: process.env.LEGAL_EFFECTIVE_DATE || '',
  LEGAL_COURT: process.env.LEGAL_COURT || '',
};
// True when `dir` sits on its own persistent mount (e.g. a Render disk at /data),
// not on the container's throwaway root or on a RAM disk.
const VOLATILE_FS = new Set(['overlay', 'tmpfs', 'ramfs', 'proc', 'sysfs', 'devtmpfs', 'rootfs', 'aufs']);
function isOnPersistentMount(dir, mountsText) {
  if (mountsText === undefined) { try { mountsText = fs.readFileSync('/proc/mounts', 'utf8'); } catch { return false; } }
  let best = null;
  for (const line of mountsText.split('\n')) {
    const [, mnt, type] = line.split(' ');
    if (!mnt || mnt === '/') continue;
    const m = mnt.replace(/\\040/g, ' ');
    if ((dir === m || dir.startsWith(m.endsWith('/') ? m : m + '/')) && (!best || m.length > best.m.length)) best = { m, type };
  }
  return !!best && !VOLATILE_FS.has(best.type);
}
const DB_ON_DISK = isOnPersistentMount(path.dirname(path.resolve(CFG.dbPath)));
// Real sales only open once everything a buyer and the law need is in place.
function salesBlockers(game) {
  if (CFG.mode !== 'stripe') return [];
  const missing = [];
  if (game === GAMES.nakasu && !GAMES.nakasu.url) missing.push('NAKASU_URL');
  if (!CFG.stripeKey) missing.push('STRIPE_SECRET_KEY');
  if (!CFG.webhookSecret) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!SELLER.SELLER_NAME) missing.push('SELLER_NAME');
  if (!SELLER.SELLER_EMAIL) missing.push('SELLER_EMAIL');
  // Set on hosting without persistent storage (e.g. Render Free), where purchase records would be lost.
  if (process.env.SALES_DISABLED === '1') missing.push('SALES_DISABLED=1');
  // Purchase records must survive restarts before money can be taken.
  if (process.env.REQUIRE_PERSISTENT_DISK === '1' && !DB_ON_DISK) missing.push('persistent disk for ' + CFG.dbPath);
  return missing;
}
if (salesBlockers().length) console.warn('販売は停止中です。未設定の環境変数: ' + salesBlockers().join(', '));
if (CFG.mode === 'mock' && process.env.NODE_ENV === 'production') {
  console.error('本番環境（NODE_ENV=production）ではテスト決済（PAYMENT_MODE=mock）は使えません');
  process.exit(1);
}

// ---------- database ----------
fs.mkdirSync(path.dirname(CFG.dbPath), { recursive: true });
const db = new DatabaseSync(CFG.dbPath);
db.exec(`
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, token_hash TEXT UNIQUE NOT NULL, transfer_code TEXT UNIQUE NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS saves(user_id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, user_id TEXT NOT NULL, product TEXT NOT NULL, amount INTEGER NOT NULL,
  status TEXT NOT NULL, stripe_session TEXT UNIQUE, created_at INTEGER NOT NULL, paid_at INTEGER);
CREATE TABLE IF NOT EXISTS grants(id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, order_id TEXT UNIQUE NOT NULL,
  items TEXT NOT NULL, created_at INTEGER NOT NULL, acked_at INTEGER);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, status, paid_at);
CREATE INDEX IF NOT EXISTS grants_user ON grants(user_id, acked_at);
`);
if (!db.prepare('PRAGMA table_info(users)').all().some(c => c.name === 'game')) db.exec("ALTER TABLE users ADD COLUMN game TEXT NOT NULL DEFAULT 'jingi'");
const q = {
  insUser: db.prepare('INSERT INTO users(id,token_hash,transfer_code,created_at,game) VALUES(?,?,?,?,?)'),
  userByToken: db.prepare('SELECT * FROM users WHERE token_hash=?'),
  userByCode: db.prepare('SELECT * FROM users WHERE transfer_code=?'),
  rotate: db.prepare('UPDATE users SET token_hash=?, transfer_code=? WHERE id=?'),
  getSave: db.prepare('SELECT data, updated_at FROM saves WHERE user_id=?'),
  putSave: db.prepare('INSERT INTO saves(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at'),
  insOrder: db.prepare('INSERT INTO orders(id,user_id,product,amount,status,created_at) VALUES(?,?,?,?,?,?)'),
  setSession: db.prepare('UPDATE orders SET stripe_session=? WHERE id=?'),
  order: db.prepare('SELECT * FROM orders WHERE id=?'),
  orderBySession: db.prepare('SELECT * FROM orders WHERE stripe_session=?'),
  markPaid: db.prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=? AND status<>'paid'"),
  markFailed: db.prepare("UPDATE orders SET status=? WHERE id=? AND status='pending'"),
  insGrant: db.prepare('INSERT OR IGNORE INTO grants(user_id,order_id,items,created_at) VALUES(?,?,?,?)'),
  pending: db.prepare('SELECT id, items, order_id FROM grants WHERE user_id=? AND acked_at IS NULL ORDER BY id'),
  ack: db.prepare('UPDATE grants SET acked_at=? WHERE id=? AND user_id=? AND acked_at IS NULL'),
  spent: db.prepare("SELECT COALESCE(SUM(amount),0) AS s FROM orders WHERE user_id=? AND status='paid' AND paid_at>=?"),
};

const now = () => Date.now();
const rid = (n = 16) => crypto.randomBytes(n).toString('hex');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
// 12-char transfer code without look-alike characters
function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (const b of crypto.randomBytes(12)) s += A[b % A.length];
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8);
}
// Start of the current calendar month in Japan time, as epoch ms
function monthStartJST(t = now()) {
  const j = new Date(t + 9 * 3600e3);
  return Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), 1) - 9 * 3600e3;
}
const spentThisMonth = uid => q.spent.get(uid, monthStartJST()).s;

// Idempotent: marks the order paid and records the items to hand over once.
function fulfill(orderId) {
  const o = q.order.get(orderId);
  if (!o) return false;
  const p = PRODUCTS.find(x => x.id === o.product);
  if (!p) return false;
  db.exec('BEGIN');
  try {
    q.markPaid.run(now(), orderId);
    q.insGrant.run(o.user_id, orderId, JSON.stringify(p.items), now());
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return true;
}

// ---------- Stripe (REST, no SDK) ----------
function form(obj, prefix, out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v !== null && typeof v === 'object') form(v, key, out);
    else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}
async function stripe(method, p, body, idem) {
  const headers = { Authorization: 'Bearer ' + CFG.stripeKey, 'Stripe-Version': CFG.stripeVersion };
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (idem) headers['Idempotency-Key'] = idem;
  const r = await fetch('https://api.stripe.com/v1' + p, { method, headers, body: body ? form(body) : undefined });
  const j = await r.json();
  if (!r.ok) throw new Error('Stripe: ' + (j.error && j.error.message || r.status));
  return j;
}
// Stripe-Signature: t=timestamp,v1=hex(hmac_sha256(secret, `${t}.${rawBody}`))
function verifyStripeSignature(raw, header, secret, tolerance = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map(kv => { const i = kv.indexOf('='); return [kv.slice(0, i), kv.slice(i + 1)]; }));
  const sigs = header.split(',').filter(kv => kv.startsWith('v1=')).map(kv => kv.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(now() / 1000 - t) > tolerance) return false;
  const expected = crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
  return sigs.some(s => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
function fulfillFromSession(s) {
  const orderId = s.metadata && s.metadata.order_id;
  const o = orderId && q.order.get(orderId);
  if (!o) return false;
  if (s.payment_status !== 'paid' || s.currency !== 'jpy' || s.amount_total !== o.amount) return false;
  return fulfill(orderId);
}

// ---------- http helpers ----------
const MAX_BODY = 64 * 1024;
function readBody(req) {
  return new Promise((res, rej) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > MAX_BODY) { rej(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => res(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rej);
  });
}
const SEC_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN' };
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...SEC_HEADERS, ...(res.cors || {}) });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
const err = (status, message, en) => Object.assign(new Error(message), { status, en });
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const t = now(); const h = hits.get(key);
  if (!h || h.reset < t) { hits.set(key, { n: 1, reset: t + windowMs }); return; }
  if (++h.n > max) throw err(429, 'リクエストが多すぎます。少し待ってから試してください');
}
setInterval(() => { const t = now(); for (const [k, v] of hits) if (v.reset < t) hits.delete(k); }, 60e3).unref();
const ipOf = req => (CFG.trustProxy && (req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
function auth(req) {
  const m = (req.headers.authorization || '').match(/^Bearer ([a-f0-9]{64})$/);
  const u = m && q.userByToken.get(sha(m[1]));
  if (!u) throw err(401, 'ログイン情報が無効です');
  return u;
}
async function json(req) {
  const raw = await readBody(req);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw err(400, 'JSONが不正です'); }
}
const publicProduct = p => ({ id: p.id, name: p.name, desc: p.desc, name_en: p.name_en, desc_en: p.desc_en, price: p.price, items: p.items });

// ---------- static ----------
function gameHtml() {
  const src = fs.readFileSync(CFG.gameFile, 'utf8');
  return src.replace('<style>', "<script>window.GAME_API='';</script>\n<style>");
}
const LEGAL_DIR = path.join(__dirname, 'public', 'legal');
const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Fills {{SELLER_NAME}} etc. Anything not set stays visibly marked 【未設定】.
const legalHtml = src => src.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in SELLER ? (SELLER[k] ? esc(SELLER[k]) : '<span class="todo">【未設定】</span>') : m));
const mockPage = order => `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>テスト決済</title><body style="font-family:sans-serif;background:#1d0030;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
<div style="max-width:360px;padding:24px;border:2px solid #ff4fd8;border-radius:14px;text-align:center">
<h2>テスト決済</h2><p>PAYMENT_MODE=mock のため、本物の請求は発生しません。</p>
<p><b>${order.product}</b><br>¥${order.amount.toLocaleString()}</p>
<button id="pay" style="font-size:18px;padding:12px 28px;border-radius:24px;border:0;background:#ff4fd8;color:#fff">支払う（テスト）</button>
<p><a href="${esc(order.back)}?purchase=cancel" style="color:#ccc">キャンセル</a></p></div>
<script>document.getElementById('pay').onclick=async()=>{const r=await fetch('/api/mock/pay',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({order:${JSON.stringify(order.id)}})});const j=await r.json();location.href=j.redirect;};</script></body></html>`;

// ---------- routes ----------
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const M = req.method;
  const origin = req.headers.origin;
  if (p.startsWith('/api/') && origin && CORS_ORIGINS.has(origin)) {
    res.cors = { 'Access-Control-Allow-Origin': origin, Vary: 'Origin', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Lang',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS', 'Access-Control-Max-Age': '600' };
    if (M === 'OPTIONS') { res.writeHead(204, res.cors); return res.end(); }
  }
  if (p.startsWith('/api/')) rateLimit('api:' + ipOf(req), 240, 60e3);

  if (M === 'GET' && (p === '/' || p === '/index.html')) return send(res, 200, gameHtml(), 'text/html; charset=utf-8');
  if (M === 'GET' && (p === '/about' || p === '/about.html')) {
    const row = (n, d, price) => `<tr><td>${esc(n)}</td><td>${esc(d)}</td><td class="price">¥${price.toLocaleString()}</td></tr>`;
    const html = fs.readFileSync(path.join(__dirname, 'public', 'about.html'), 'utf8')
      .replace('{{PRODUCT_ROWS}}', PRODUCTS_JINGI.map(x => row(x.name, x.desc, x.price)).join(''))
      .replace('{{PRODUCT_ROWS_EN}}', PRODUCTS_JINGI.map(x => row(x.name_en || x.name, x.desc_en || x.desc, x.price)).join(''))
      .replace('{{NAKASU_ROWS}}', PRODUCTS_NAKASU.map(x => row(x.name, x.desc, x.price)).join(''))
      .replace('{{NAKASU_URL}}', esc(GAMES.nakasu.url || '#'));
    return send(res, 200, legalHtml(html), 'text/html; charset=utf-8');
  }
  if (M === 'GET' && /^\/legal\/[a-z]+\.html$/.test(p)) {
    const f = path.join(LEGAL_DIR, path.basename(p));
    if (fs.existsSync(f)) return send(res, 200, legalHtml(fs.readFileSync(f, 'utf8')), 'text/html; charset=utf-8');
  }
  if (M === 'GET' && p === '/api/health') return send(res, 200, { ok: true, mode: CFG.mode, salesOpen: !salesBlockers().length, waitingFor: salesBlockers(), nakasuSalesOpen: !salesBlockers(GAMES.nakasu).length, nakasuWaitingFor: salesBlockers(GAMES.nakasu), persistentDisk: DB_ON_DISK });

  if (M === 'POST' && p === '/api/session') {
    rateLimit('session:' + ipOf(req), 20, 60e3);
    const b = await json(req);
    const game = b.game === undefined ? 'jingi' : String(b.game);
    if (!GAMES[game]) throw err(400, 'ゲームが不正です');
    const token = rid(32), id = 'u_' + rid(10), code = newCode();
    q.insUser.run(id, sha(token), code, now(), game);
    return send(res, 200, { userId: id, token, transferCode: code });
  }
  if (M === 'GET' && p === '/api/me') {
    const u = auth(req);
    const g = gameOf(u);
    return send(res, 200, { userId: u.id, game: u.game, transferCode: u.transfer_code, spentThisMonth: spentThisMonth(u.id), monthlyLimit: g.monthlyLimit, paymentMode: CFG.mode, salesOpen: !salesBlockers(g).length });
  }
  if (M === 'GET' && p === '/api/products') return send(res, 200, { products: (GAMES[url.searchParams.get('game')] || GAMES.jingi).products.map(publicProduct) });

  if (p === '/api/save') {
    const u = auth(req);
    if (M === 'GET') { const s = q.getSave.get(u.id); return send(res, 200, { data: s ? JSON.parse(s.data) : null, updatedAt: s ? s.updated_at : 0 }); }
    if (M === 'PUT') {
      const b = await json(req);
      if (!b.data || typeof b.data !== 'object' || Array.isArray(b.data)) throw err(400, 'セーブデータが不正です');
      q.putSave.run(u.id, JSON.stringify(b.data), now());
      return send(res, 200, { ok: true });
    }
  }

  if (M === 'POST' && p === '/api/transfer') {
    rateLimit('transfer:' + ipOf(req), 10, 10 * 60e3);
    const b = await json(req);
    const code = String(b.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const fmt = code.length === 12 ? code.slice(0, 4) + '-' + code.slice(4, 8) + '-' + code.slice(8) : '';
    const u = fmt && q.userByCode.get(fmt);
    if (!u || u.game !== (b.game === undefined ? 'jingi' : String(b.game))) throw err(404, '引き継ぎコードが見つかりません');
    const token = rid(32), next = newCode();
    q.rotate.run(sha(token), next, u.id); // old device is signed out, code is single-use
    return send(res, 200, { userId: u.id, token, transferCode: next });
  }

  if (M === 'POST' && p === '/api/checkout') {
    const u = auth(req);
    rateLimit('checkout:' + u.id, 10, 60e3);
    const b = await json(req);
    const g = gameOf(u);
    const prod = g.products.find(x => x.id === b.product);
    if (!prod) throw err(400, '商品が見つかりません');
    if (salesBlockers(g).length) throw err(503, '現在、販売の準備中です', 'The shop is not open yet');
    if (b.consent !== true) throw err(400, '購入前の確認にチェックしてください');
    if (spentThisMonth(u.id) + prod.price > g.monthlyLimit) throw err(403, `今月の購入上限（¥${g.monthlyLimit.toLocaleString()}）を超えるため購入できません`, `This purchase would go over the monthly limit (¥${g.monthlyLimit.toLocaleString()})`);
    const orderId = 'o_' + rid(12);
    q.insOrder.run(orderId, u.id, prod.id, prod.price, 'pending', now());
    if (CFG.mode === 'mock') return send(res, 200, { url: `${u.game === 'jingi' ? '' : CFG.publicUrl}/mock-checkout?order=${orderId}` });
    const s = await stripe('POST', '/checkout/sessions', {
      mode: 'payment', locale: b.lang === 'en' ? 'en' : 'ja', client_reference_id: u.id,
      line_items: { 0: { quantity: 1, price_data: { currency: 'jpy', unit_amount: prod.price, product_data: Object.assign(b.lang === 'en' ? { name: prod.name_en || prod.name, description: prod.desc_en || prod.desc } : { name: prod.name, description: prod.desc }, CFG.taxCode ? { tax_code: CFG.taxCode } : {}) } } },
      metadata: { order_id: orderId, user_id: u.id, product: prod.id, game: u.game },
      ...(CFG.managedPayments === 'off' ? { managed_payments: { enabled: false } } : {}),
      success_url: `${g.url}?purchase=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${g.url}?purchase=cancel`,
    }, orderId);
    q.setSession.run(s.id, orderId);
    return send(res, 200, { url: s.url });
  }
  // Called when the buyer returns, in case the webhook has not arrived yet.
  if (M === 'POST' && p === '/api/checkout/confirm') {
    const u = auth(req);
    const b = await json(req);
    if (CFG.mode !== 'stripe' || !/^cs_[A-Za-z0-9_]+$/.test(b.sessionId || '')) return send(res, 200, { ok: true });
    const o = q.orderBySession.get(b.sessionId);
    if (!o || o.user_id !== u.id) throw err(404, '注文が見つかりません');
    const s = await stripe('GET', '/checkout/sessions/' + encodeURIComponent(b.sessionId));
    return send(res, 200, { ok: true, paid: fulfillFromSession(s) && q.order.get(o.id).status === 'paid' });
  }
  if (M === 'GET' && p === '/api/grants') {
    const u = auth(req);
    return send(res, 200, { grants: q.pending.all(u.id).map(g => ({ id: g.id, items: JSON.parse(g.items), orderId: g.order_id })) });
  }
  if (M === 'POST' && p === '/api/grants/ack') {
    const u = auth(req);
    const b = await json(req);
    for (const id of Array.isArray(b.ids) ? b.ids.slice(0, 50) : []) q.ack.run(now(), Number(id), u.id);
    return send(res, 200, { ok: true });
  }

  if (M === 'POST' && p === '/api/stripe/webhook') {
    const raw = await readBody(req);
    if (!verifyStripeSignature(raw, req.headers['stripe-signature'], CFG.webhookSecret)) return send(res, 400, { error: 'bad signature' });
    const ev = JSON.parse(raw);
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') fulfillFromSession(ev.data.object);
    else if (ev.type === 'checkout.session.expired' || ev.type === 'checkout.session.async_payment_failed') {
      const id = ev.data.object.metadata && ev.data.object.metadata.order_id;
      if (id) q.markFailed.run(ev.type === 'checkout.session.expired' ? 'expired' : 'failed', id);
    }
    return send(res, 200, { received: true });
  }

  if (CFG.mode === 'mock') {
    if (M === 'GET' && p === '/mock-checkout') {
      const o = q.order.get(url.searchParams.get('order') || '');
      if (!o || o.status !== 'pending') return send(res, 404, '注文が見つかりません', 'text/plain; charset=utf-8');
      const owner = db.prepare('SELECT game FROM users WHERE id=?').get(o.user_id);
      return send(res, 200, mockPage({ ...o, back: (GAMES[owner && owner.game] || GAMES.jingi).url }), 'text/html; charset=utf-8');
    }
    if (M === 'POST' && p === '/api/mock/pay') {
      const b = await json(req);
      const o = q.order.get(String(b.order || ''));
      if (!o || !fulfill(o.id)) throw err(404, '注文が見つかりません');
      const owner = db.prepare('SELECT game FROM users WHERE id=?').get(o.user_id);
      return send(res, 200, { redirect: (GAMES[owner && owner.game] || GAMES.jingi).url + '?purchase=success&session_id=mock' });
    }
  }
  send(res, 404, { error: 'not found' });
}

const server = http.createServer((req, res) => {
  handle(req, res).catch(e => {
    if (!e.status) console.error(e);
    const en = req.headers['x-lang'] === 'en';
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? (en && e.en ? e.en : e.message) : 'サーバーエラーが発生しました' });
  });
});
if (require.main === module) {
  server.listen(CFG.port, () => console.log(`仁義サンシャイン server: ${CFG.publicUrl} (payment: ${CFG.mode})`));
}
module.exports = { server, verifyStripeSignature, monthStartJST, isOnPersistentMount, CFG, GAMES };
