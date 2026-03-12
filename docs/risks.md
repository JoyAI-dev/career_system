# Risks

## Known Risks

- **Questionnaire versioning complexity:** Structural changes to questionnaires must create new versions; migrating users between versions requires careful snapshot management
- **Activity concurrency:** Join operations under high load may cause race conditions without transactional capacity checks and unique constraints
- **PII exposure:** Student ID uploads contain sensitive personal data; requires private storage, access audit, and retention policy
- **Auth.js Credentials limitations:** Credentials provider does not persist users automatically; custom User table and password management required

## Security Notes

- Passwords: bcrypt hashed, never stored in plain text
- Sessions: JWT-based (Auth.js), short expiry with refresh
- File uploads: MIME type validation, size limits, auth-gated file serving
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
- File retention/backup policy for uploaded student IDs
- Data privacy compliance requirements for Chinese university context
