export function normalizePhone(value) {
  const raw = String(value).trim();
  if (!/^[+\d\s()-]+$/.test(raw) || (raw.includes('+') && (!raw.startsWith('+') || (raw.match(/\+/g) || []).length !== 1))) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  if ((raw.startsWith('+') || raw.startsWith('00')) && /^[1-9]\d{7,14}$/.test(digits) && !digits.startsWith('91')) return `+${digits}`;
  return null;
}

export async function submitAppointment(data, fetcher = fetch) {
  const name = String(data.get('name') || '').trim();
  const phone = normalizePhone(data.get('phone') || '');
  if (name.length < 2 || name.length > 80 || !phone || data.get('consent') !== 'callback-request' || data.get('website')) throw new Error('Invalid request');
  const body = new URLSearchParams({ 'form-name': 'appointment-request', name, phone, consent: 'callback-request', website: '' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetcher('/', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: body.toString(), signal: controller.signal});
    if (!response.ok) throw new Error('Submission rejected');
  } finally { clearTimeout(timeout); }
}
