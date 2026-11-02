// Public observations are snapshots, not a live feed. Recheck before publication.
export const reviewSnapshot = {
  rating: '4.9', count: 546, checked: '29 October 2026', checkedISO: '2026-10-29',
  source: 'https://share.google/NA6TsX8eHiOCI6SmB',
} as const;
export const reviews = [
  {name: 'Darshan Raut', stars: 5, topic: 'Extraction & filling', excerpt: 'Both were performed very Skill-fully and  professionally.', summary: 'A wisdom tooth extraction and a filling, with feedback on the procedures and how appointments were managed.', contributor: '105581283753867451175'},
  {name: 'Gheesaram Seervi', stars: 5, topic: 'Teeth cleaning', excerpt: 'great experience, polite staff and affordable rates.', summary: 'A cleaning visit, with positive feedback about the staff and value.', contributor: '113668548362276266004'},
  {name: 'Sasanka Panigrahi', stars: 5, topic: 'Dental care', excerpt: 'diagnosis and equally good service', summary: 'Feedback on diagnosis and the care experience.', contributor: '112845223043979941658'},
].map(review => ({...review, url: `https://www.google.com/maps/reviews/data=!4m5!14m4!1m3!1m2!1s${review.contributor}!2s0x3bc2c17a80f756a9:0xbdd6e4e02c97e4eb`}));

export const clinicalUpdates = [
  {title: 'A closer look at repeat root canal treatment', category: 'Clinic case update', date: '9 July 2026', source: 'https://share.google/PTcv1V8O4lK4bZgx8', description: 'A published case discusses assessment of a previously treated tooth, removal of a retained instrument and crown restoration.', treatment: 'root-canal-treatment'},
  {title: 'Composite bonding for a front-tooth gap', category: 'Treatment explained', date: '16 September 2026', source: 'https://share.google/yZuKEJ8jFTMA7svF5', description: 'A clinic update about composite bonding for a front-tooth gap. Read the original explanation on Google.', treatment: 'smile-makeover'},
  {title: 'An update on instrument sterilisation', category: 'Inside the clinic', date: '22 September 2026', source: 'https://share.google/CcqQHmP1biFKamGAy', description: 'The clinic announced an autoclave upgrade for instrument sterilisation. Ask the team about its current preparation and cleaning process.', treatment: null},
] as const;

export const doctor = {
  name: 'Dr. Bhakti Ghanwat Gavade', degree: 'BDS', college: 'Government Dental College & Hospital, Mumbai',
  registration: 'A-33908', council: 'Maharashtra State Dental Council',
  profile: '/doctors/dr-bhakti-ghanwat-gavade/', confirmed: '29 September 2026',
} as const;
