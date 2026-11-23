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
