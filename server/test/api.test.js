'use strict';
// Run: cd server && npm test
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'jingi-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.PAYMENT_MODE = 'mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123';
process.env.MONTHLY_LIMIT_JPY = '700';
process.env.PORT = '0';
process.env.SELLER_NAME = 'テスト<商店>';
process.env.SELLER_EMAIL = 'shop@example.com';
const { server } = require('../server');

let base;
test.before(() => new Promise(r => server.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); })));
test.after(() => { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); });

async function call(method, p, body, token, headers = {}) {
  const r = await fetch(base + p, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const sign = (raw, secret = 'whsec_test123', t = Math.floor(Date.now() / 1000)) =>
  `t=${t},v1=` + crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');

test('serves the game with the API flag injected', async () => {
  const html = await (await fetch(base + '/')).text();
  assert.match(html, /window\.GAME_API=''/);
});

test('session, save, purchase, grants, monthly limit, transfer', async () => {
  const s = await call('POST', '/api/session');
  assert.equal(s.status, 200);
  const tok = s.body.token;
  assert.equal((await call('GET', '/api/save', undefined, 'f'.repeat(64))).status, 401);

  assert.equal((await call('PUT', '/api/save', { data: { money: 123, savedAt: 1 } }, tok)).status, 200);
  assert.equal((await call('GET', '/api/save', undefined, tok)).body.data.money, 123);

  assert.equal((await call('POST', '/api/checkout', { product: 'jingi' }, tok)).status, 400, 'needs consent');
  const c = await call('POST', '/api/checkout', { product: 'jingi', consent: true }, tok);
  assert.equal(c.status, 200);
  const order = new URL(c.body.url, base).searchParams.get('order');
  assert.equal((await call('GET', '/api/grants', undefined, tok)).body.grants.length, 0, 'nothing before payment');

  const pay = await call('POST', '/api/mock/pay', { order });
  assert.equal(pay.status, 200);
  await call('POST', '/api/mock/pay', { order }); // paying twice must not double-grant
  const g = (await call('GET', '/api/grants', undefined, tok)).body.grants;
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].items, { fan: 2, hammer: 3, katana: 3, board: 3 });

  // 600 spent, limit 700: a 120 item is refused
  const over = await call('POST', '/api/checkout', { product: 'katana3', consent: true }, tok);
  assert.equal(over.status, 403);
  assert.equal((await call('GET', '/api/me', undefined, tok)).body.spentThisMonth, 600);

  await call('POST', '/api/grants/ack', { ids: [g[0].id] }, tok);
  assert.equal((await call('GET', '/api/grants', undefined, tok)).body.grants.length, 0);

  const code = s.body.transferCode;
  const t = await call('POST', '/api/transfer', { code: code.toLowerCase() });
  assert.equal(t.status, 200);
  assert.equal((await call('GET', '/api/save', undefined, t.body.token)).body.data.money, 123);
  assert.equal((await call('GET', '/api/save', undefined, tok)).status, 401, 'old device signed out');
  assert.equal((await call('POST', '/api/transfer', { code })).status, 404, 'code is single-use');
});

test('stripe webhook: signature check and fulfilment', async () => {
  const tok = (await call('POST', '/api/session')).body.token;
  const c = await call('POST', '/api/checkout', { product: 'fan', consent: true }, tok);
  const order = new URL(c.body.url, base).searchParams.get('order');
  const ev = (amount, status = 'paid') => JSON.stringify({ type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', payment_status: status, currency: 'jpy', amount_total: amount, metadata: { order_id: order } } } });

  let raw = ev(300);
  assert.equal((await call('POST', '/api/stripe/webhook', raw, null, { 'Stripe-Signature': sign(raw, 'wrong') })).status, 400);
  assert.equal((await call('POST', '/api/stripe/webhook', raw, null, { 'Stripe-Signature': sign(raw, undefined, 1000) })).status, 400, 'old timestamp');

  raw = ev(1); // wrong amount is ignored
  assert.equal((await call('POST', '/api/stripe/webhook', raw, null, { 'Stripe-Signature': sign(raw) })).status, 200);
  raw = ev(300, 'unpaid'); // e.g. konbini not paid yet
  await call('POST', '/api/stripe/webhook', raw, null, { 'Stripe-Signature': sign(raw) });
  assert.equal((await call('GET', '/api/grants', undefined, tok)).body.grants.length, 0);

  raw = ev(300);
  assert.equal((await call('POST', '/api/stripe/webhook', raw, null, { 'Stripe-Signature': sign(raw) })).status, 200);
  await call('POST', '/api/stripe/webhook', raw, null, { 'Stripe-Signature': sign(raw) }); // Stripe retries
  const g = (await call('GET', '/api/grants', undefined, tok)).body.grants;
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].items, { fan: 1 });
});

test('legal pages are filled from env vars and escaped', async () => {
  const html = await (await fetch(base + '/legal/tokushoho.html')).text();
  assert.match(html, /テスト&lt;商店&gt;/);
  assert.match(html, /shop@example\.com/);
  assert.match(html, /請求があった場合には遅滞なく開示します/);
  assert.doesNotMatch(html, /\{\{/);
});

test('production stripe mode keeps sales closed until configured', async () => {
  const { spawn } = require('node:child_process');
  const port = 18000 + Math.floor(Math.random() * 1000);
  const env = { ...process.env, PORT: String(port), PAYMENT_MODE: 'stripe', NODE_ENV: 'production', DB_PATH: path.join(tmp, 'prod.db'),
    STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', SELLER_NAME: 'x', SELLER_EMAIL: 'x@example.com', SALES_DISABLED: '1' };
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', path.join(__dirname, '..', 'server.js')], { env, stdio: 'ignore' });
  try {
    const url = `http://127.0.0.1:${port}`;
    let h;
    for (let i = 0; i < 50 && !h; i++) { try { h = await (await fetch(url + '/api/health')).json(); } catch { await new Promise(r => setTimeout(r, 100)); } }
    assert.equal(h.salesOpen, false);
    const tok = (await (await fetch(url + '/api/session', { method: 'POST' })).json()).token;
    const r = await fetch(url + '/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok, 'X-Lang': 'en' }, body: JSON.stringify({ product: 'fan', consent: true }) });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).error, 'The shop is not open yet');
  } finally { child.kill(); }
});

test('about page lists products and seller from env', async () => {
  const html = await (await fetch(base + '/about')).text();
  assert.match(html, /仁義フルセット/);
  assert.match(html, /Jingi Full Set/);
  assert.match(html, /¥600/);
  assert.match(html, /テスト&lt;商店&gt;/);
  assert.doesNotMatch(html, /\{\{/);
});
