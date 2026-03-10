# Testing

## Test Frameworks

| Framework | Purpose |
|-----------|---------|
| Vitest | Unit and integration tests |
| React Testing Library | Component testing |
| Playwright | End-to-end testing |

## Test Locations

| Type | Location |
|------|----------|
| Unit tests | `src/**/*.test.ts` |
| Component tests | `src/**/*.test.tsx` |
| E2E tests | `e2e/**/*.spec.ts` |

## Commands

```bash
# Run all unit/integration tests
npm test

# Run tests in watch mode
npm run test:watch

# Run E2E tests
npx playwright test

# Coverage report
npm run test:coverage
```

## Test Pyramid

- **Unit tests:** Business logic, scoring engine, state machine transitions, validation
- **Integration tests:** Auth flows, API routes, database queries, Server Actions
- **E2E tests:** Critical user journeys (registration → questionnaire → activity → growth loop)

## Test Structure

Follow Arrange-Act-Assert (AAA) pattern:
```
describe('ScoringEngine')
  it('calculates topic score as average of question scores')
    // Arrange: set up test data
    // Act: call scoring function
    // Assert: verify result
```

## Test Data

- Seed script provides baseline test data
- Use factories/fixtures for test-specific data
- Never depend on external services in unit tests; mock Prisma client

## Coverage Targets

- Scoring engine: 90%+
- State machine transitions: 90%+
- Auth flows: 80%+
- UI components: 70%+
