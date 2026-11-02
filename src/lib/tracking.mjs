const supportedEvents = new Set([
  'call_click',
  'whatsapp_click',
  'whatsapp_booking_click',
  'directions_click',
  'appointment_request_success',
]);

// Never include a URL, title, treatment, message or user-entered value here.
// Vendor automatic collection still requires separate approval and payload tests.
export function buildClinicEvent(eventName) {
  if (!supportedEvents.has(eventName)) return null;
  return Object.freeze({
    event: eventName,
    event_source: '32_whites_website',
  });
}
