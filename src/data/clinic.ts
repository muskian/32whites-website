import {doctor} from './evidence';
import {createWhatsAppBookingUrl} from '../lib/whatsapp.mjs';
export const clinic = {
  name: '32 Whites Multispecialty dental clinic',
  shortName: '32 Whites',
  url: 'https://32whitesdental.com',
  phone: '+919890889241',
  phoneDisplay: '+91 98908 89241',
  whatsapp: '919890889241',
  address: 'Arc Pukhraj, Opp. Renuka Mata Mandir, Keshavnagar, Pune 411036',
  street: 'Arc Pukhraj, Opp. Renuka Mata Mandir, Keshavnagar',
  hours: 'Monday–Saturday: 10am–9pm',
  sunday: 'Sunday: 11am–5pm',
  languages: ['English', 'Hindi', 'Marathi'],
  parking: 'Parking available',
  access: 'Access involves stairs',
  doctor: 'Dr. Bhakti Ghanwat Gavade',
  maps: 'https://share.google/NA6TsX8eHiOCI6SmB',
  contactSource: 'Owner approved Google Business Profile phone and regular hours on 29 September 2026; Sunday hours updated by the owner to 11am–5pm on 2 November 2026.',
} as const;

export const production = import.meta.env.PUBLIC_SITE_INDEXABLE === 'true';
export const formsEnabled = import.meta.env.PUBLIC_FORMS_ENABLED === 'true';
export const whatsappBookingUrl = (context = 'General booking') => createWhatsAppBookingUrl(clinic.whatsapp, context);
export const organizationId = `${clinic.url}/#clinic`;

export function clinicSchema() {
  return {
    '@type': 'Dentist', '@id': organizationId, name: clinic.name, url: clinic.url,
    telephone: clinic.phone,
    image: `${clinic.url}/images/clinic-960.webp`,
    logo: `${clinic.url}/images/logo.png`,
    sameAs: [clinic.maps],
    address: {
      '@type': 'PostalAddress', streetAddress: clinic.street, addressLocality: 'Pune',
      addressRegion: 'Maharashtra', postalCode: '411036', addressCountry: 'IN',
    },
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '10:00', closes: '21:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Sunday', opens: '11:00', closes: '17:00' },
    ],
    hasMap: clinic.maps,
    contactPoint: {'@type': 'ContactPoint', telephone: clinic.phone, contactType: 'Appointments', availableLanguage: clinic.languages},
    employee: {'@id': `${clinic.url}/#doctor`},
  };
}

export function doctorSchema() {
  return {
    '@type': 'Person', '@id': `${clinic.url}/#doctor`, name: doctor.name,
    url: `${clinic.url}${doctor.profile}`, jobTitle: 'Dentist', worksFor: {'@id': organizationId},
    alumniOf: {'@type': 'CollegeOrUniversity', name: doctor.college},
    hasCredential: [
      {'@type': 'EducationalOccupationalCredential', name: 'Bachelor of Dental Surgery (BDS)', credentialCategory: 'Degree'},
      {'@type': 'EducationalOccupationalCredential', name: `${doctor.council} registration ${doctor.registration}`, identifier: doctor.registration, credentialCategory: 'Professional registration', recognizedBy: {'@type': 'Organization', name: doctor.council}},
    ],
  };
}
