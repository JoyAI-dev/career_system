# Risks

## Known Risks

- **Questionnaire versioning complexity:** Structural changes to questionnaires must create new versions; migrating users between versions requires careful snapshot management
- **Activity concurrency:** Join operations under high load may cause race conditions without transactional capacity checks and unique constraints
- **PII exposure:** Student ID uploads contain sensitive personal data; requires private storage, signed URLs, access audit, and retention policy
- **Auth.js Credentials limitations:** Credentials provider does not persist users automatically; custom User table and password management required
- **Supabase dependency:** Single vendor for DB + Storage; plan migration path if needed

## Security Notes

- Passwords: bcrypt hashed, never stored in plain text
- Sessions: JWT-based (Auth.js), short expiry with refresh
- File uploads: MIME type validation, size limits, private bucket only
- Admin routes: Middleware-enforced role check on all `/admin` paths
- API validation: Zod schemas on all inputs at API boundary
- No secrets in client bundle; all sensitive config server-side only

## Fragile Areas

- **Scoring engine:** Changes to score calculation formula affect all historical comparisons; must be version-aware
- **Activity state machine:** State transitions must be atomic; partial transitions corrupt workflow
- **Progressive unlock logic:** Depends on correct activity type ordering and completion tracking

## Unknowns / Open Questions

- Exact password policy requirements (min length, complexity rules)
- Student ID verification workflow (manual admin review? automated?)
- Rate limiting strategy for login attempts (Auth.js built-in vs custom)
- Backup and disaster recovery for Supabase-hosted data
- GDPR/data privacy compliance requirements for Chinese university context
