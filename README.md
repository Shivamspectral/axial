# ASTRA Feedback Intelligence — Siddhant COE

## Staff authentication mode

HOD and Super Admin authentication is intentionally **JavaScript-only**. Their email/password credentials are stored in `app.js`; Supabase Auth is not used for staff login.

Configured accounts:
- Super Admin: `vedaware33@gmail.com` / `astra@ce2026`
- HOD: `sonalirangdale@scoe.edu` / `sonali@ce`

Student IDs and all feedback/application data remain in Supabase.

### Important security note
JS-only credentials are visible to anyone who can inspect the deployed frontend. The `x-staff-email` and `x-staff-role` headers provide an application-level gate for Supabase RLS, not cryptographic authentication. Do not use this architecture for sensitive or public-facing administrative systems where strong authentication is required.

## Deployment

1. Deploy the contents of this folder.
2. The included `schema.sql` contains the JS-only staff RLS policy replacement.
3. The live Supabase project has already been updated with the same policy functions/policies.
4. No HOD or Super Admin Supabase Auth account is required by the frontend.
