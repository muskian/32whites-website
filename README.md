# 32 Whites website

Static Astro website for 32 Whites Multispecialty dental clinic.

Use Node 24.22.1 or a later supported Node 24 security patch. Run `npm ci`, `npm test` and `npm run build`. Netlify base directory is the repository root, build command `npm run build`, publish directory `dist`. The repository-root netlify.toml specifies the supported runtime and preview defaults.

Previews remain noindex and forms disabled. Keep Deploy Previews private to the existing Netlify team before publishing a preview. Do not merge the staging branch or publish to production before final launch acceptance and owner deployment authorization.

All 24 clinical pages were approved by Dr. Bhakti Ghanwat Gavade on 2 November 2026. Decisions in qa/editorial-review.json bind to exact content fingerprints. Clinical main-content or metadata edits require re-review. Never alter approval guards to bypass review.

This source package includes only build/test source, optimized public assets and the necessary clinical review register. Private audits, patient data, runtime folders, caches, source artwork and historical backups are excluded. Asset regeneration and private operational/reporting utilities stay in the clinic's local workspace.

Deploy only generated dist files. Optional forms and analytics remain disabled until separately configured and accepted. A WhatsApp click is a draft request, not a confirmed appointment.
