import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePhone,submitAppointment} from '../src/lib/appointments.mjs';
const valid = () => new Map([['name','Test Visitor'],['phone','9890889241'],['consent','callback-request']]);
test('normalizes Indian and international phone formats', () => {
  assert.equal(normalizePhone('98908 89241'),'+919890889241');
  assert.equal(normalizePhone('+91 (98908) 89241'),'+919890889241');
  assert.equal(normalizePhone('09890889241'),'+919890889241');
  assert.equal(normalizePhone('+44 7700 900123'),'+447700900123');
  for (const value of ['123','1234567890','999999999999999999','+91abcdefghij','9+890889241','+91+9890889241','+911234567890']) assert.equal(normalizePhone(value),null);
});
test('rejects missing consent, invalid fields and honeypot without submitting', async () => {
  for (const [key,value] of [['consent',''],['name','A'],['phone','abc'],['website','spam']]) {
    const data=valid();data.set(key,value);
    await assert.rejects(submitAppointment(data,()=>{throw new Error('Should not send');}),/Invalid request/);
  }
});
test('posts only callback fields and a normalized number', async () => {
  let request;const data=valid();data.set('medical-notes','do not transmit');
  await submitAppointment(data,async (url, options)=>{request={url,options};return {ok:true};});
  assert.equal(request.url,'/');assert.equal(request.options.method,'POST');
  const body=new URLSearchParams(request.options.body);
  assert.equal(body.get('phone'),'+919890889241');assert.equal(body.get('form-name'),'appointment-request');assert.equal(body.has('medical-notes'),false);
});
test('HTTP failures and offline errors never resolve as success', async () => {
  for (const status of [400,403,429,500]) await assert.rejects(submitAppointment(valid(),async()=>({ok:false,status})),/Submission rejected/);
  await assert.rejects(submitAppointment(valid(),async()=>{throw new Error('Offline');}),/Offline/);
});
