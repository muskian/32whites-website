export function createWhatsAppBookingUrl(number, context = 'General booking') {
  const normalizedNumber = String(number).replace(/\D/g, '');
  const normalizedContext = String(context).replace(/\s+/g, ' ').trim().slice(0, 100) || 'General booking';
  const pageReference = normalizedContext.startsWith('/')
    ? `https://32whitesdental.com${normalizedContext}`
    : normalizedContext;
  const message = [
    'Hello 32 Whites, I would like to request a dental appointment.',
    '',
    'Source: 32 Whites website',
    `Page: ${pageReference}`,
    '',
    'Please share available appointment times and the current consultation fee.',
  ].join('\n');
  return `https://wa.me/${normalizedNumber}?text=${encodeURIComponent(message)}`;
}
