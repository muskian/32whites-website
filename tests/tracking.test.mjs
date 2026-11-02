import test from 'node:test';
import assert from 'node:assert/strict';
import {buildClinicEvent} from '../src/lib/tracking.mjs';

test('intent hooks omit clinical paths and user input even if legacy callers supply them', () => {
  assert.deepEqual(buildClinicEvent('whatsapp_booking_click', '/services/dental-implants/?name=Patient'), {
    event: 'whatsapp_booking_click',
    event_source: '32_whites_website',
  });
});

test('rejects arbitrary event names instead of accepting sensitive free text', () => {
  assert.equal(buildClinicEvent('patient_phone_98908', '/'), null);
  for (const value of [null, undefined, {}, 'search', 'appointment_confirmed', 'patient_registered']) {
    assert.equal(buildClinicEvent(value), null);
  }
});

test('events expose only the allowlisted fields and cannot be enriched by another listener', () => {
  for (const name of ['call_click', 'whatsapp_click', 'whatsapp_booking_click', 'directions_click', 'appointment_request_success']) {
    const detail = buildClinicEvent(name);
    assert.deepEqual(Object.keys(detail).sort(), ['event', 'event_source']);
    assert.equal(Object.isFrozen(detail), true);
    assert.throws(() => { detail.page_path = '/symptoms/private-condition/'; }, TypeError);
    assert.equal(JSON.stringify(detail).includes('private-condition'), false);
  }
});
