import test from 'node:test';
import assert from 'node:assert/strict';
import {createWhatsAppBookingUrl} from '../src/lib/whatsapp.mjs';

test('creates a clinic WhatsApp booking link with website attribution', () => {
  const url = new URL(createWhatsAppBookingUrl('+91 98908 89241', '/services/root-canal-treatment/'));
  assert.equal(url.hostname, 'wa.me');
  assert.equal(url.pathname, '/919890889241');
  assert.match(url.searchParams.get('text'), /request a dental appointment/);
  assert.match(url.searchParams.get('text'), /Source: 32 Whites website/);
  assert.match(url.searchParams.get('text'), /Page: https:\/\/32whitesdental\.com\/services\/root-canal-treatment\//);
  assert.doesNotMatch(url.searchParams.get('text'), /pain|diagnosis|medical history/i);
});

test('normalizes long or blank booking contexts', () => {
  const blank = new URL(createWhatsAppBookingUrl('919890889241', '   '));
  assert.match(blank.searchParams.get('text'), /Page: General booking/);
  const long = new URL(createWhatsAppBookingUrl('919890889241', 'x'.repeat(140)));
  assert.match(long.searchParams.get('text'), new RegExp(`Page: ${'x'.repeat(100)}(?:\\n|$)`));
});
