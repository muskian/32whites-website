export type ClinicEventName = 'call_click' | 'whatsapp_click' | 'whatsapp_booking_click' | 'directions_click' | 'appointment_request_success';
export interface ClinicEventDetail {
  readonly event: ClinicEventName;
  readonly event_source: '32_whites_website';
}
export function buildClinicEvent(eventName: string): Readonly<ClinicEventDetail> | null;
