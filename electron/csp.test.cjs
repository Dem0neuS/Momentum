'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DEFAULT_CSP, cspFromHtml, fallbackCsp, readCsp } = require('./csp.cjs');

const SUPABASE_ORIGIN = 'https://db.example.supabase.co';

test('cspFromHtml читает политику из собранного index.html', () => {
  const html = `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' ${SUPABASE_ORIGIN}"></head></html>`;
  assert.equal(
    cspFromHtml(html),
    `default-src 'self'; connect-src 'self' ${SUPABASE_ORIGIN}`,
  );
});

test('cspFromHtml возвращает пустую строку без meta', () => {
  assert.equal(cspFromHtml('<html></html>'), '');
});

test('fallbackCsp добавляет origin Supabase из окружения', () => {
  assert.match(
    fallbackCsp({ VITE_SUPABASE_URL: `${SUPABASE_ORIGIN}/rest/v1` }),
    new RegExp(`connect-src 'self' ${SUPABASE_ORIGIN.replaceAll('.', '\\.')}`),
  );
});

test('fallbackCsp без окружения остаётся self-only', () => {
  assert.equal(fallbackCsp({}), DEFAULT_CSP);
});

test('readCsp берёт политику из dist/index.html', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'momentum-csp-'));
  try {
    const policy = `default-src 'self'; connect-src 'self' ${SUPABASE_ORIGIN}`;
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      `<meta http-equiv="Content-Security-Policy" content="${policy}">`,
      'utf8',
    );
    assert.equal(readCsp(dir, {}), policy);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readCsp не падает, если index.html ещё не собран', () => {
  const missing = path.join(os.tmpdir(), 'momentum-csp-missing-directory');
  assert.equal(readCsp(missing, {}), DEFAULT_CSP);
});
