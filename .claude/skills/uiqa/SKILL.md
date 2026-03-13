# UIQA — UI Quality Assurance Testing

Trigger: /uiqa, UI测试, UIQA, 界面测试, UI验收

## Description

UIQA is the UI quality assurance framework for career_system. It uses seeded test data + agent-browser to verify UI flows on the staging environment (career-staging.joysort.cn).

## Environment

- **Staging URL**: https://career-staging.joysort.cn
- **Database**: Local PostgreSQL (career_staging on localhost:5432)
- **Test users**: a11-a20 (password = username)
- **Test cases**: `e2e/uiqa/Q-{N}/` directories

## Execution Modes

### Mode 1: Run Test Cases

When user invokes `/uiqa` or asks to run UI tests:

1. **List available cases**: Read all `e2e/uiqa/Q-*/manifest.json` files and display a summary table:
   ```
   | ID  | Title                  | User | Status |
   |-----|------------------------|------|--------|
   | Q-1 | 新用户公告流程          | a11  | ready  |
   | Q-2 | Preference过滤问卷验证  | a12  | ready  |
   | Q-3 | 问卷恢复与完成流程      | a13  | ready  |
   ```

2. **User selects** which case(s) to run (or "all").

3. **Execute seed**: Run the seed script for the selected case:
   ```bash
   cd /opt/workspace/joysort2026/career_system
   npx tsx e2e/uiqa/Q-{N}/seed.ts
   ```

4. **Read steps.md**: Load the detailed test steps from `e2e/uiqa/Q-{N}/steps.md`.

5. **Execute via agent-browser**: Launch the `agent-browser` agent with the steps from `steps.md`. The agent should:
   - Navigate to the staging URL
   - Follow each step precisely
   - Take screenshots at verification points
   - Report PASS/FAIL for each checkpoint

6. **Generate report**: Summarize results with:
   - Each checkpoint: PASS/FAIL
   - Screenshots for key states
   - Any discrepancies between expected and actual behavior

### Mode 2: Create New Test Case

When user wants to create a new UIQA test case:

1. **Clarify requirements**: Ask the user:
   - What flow/feature to test?
   - What is the expected behavior?
   - What are the completion criteria (pass/fail)?

2. **Analyze data requirements**: Based on the test scenario, determine:
   - Which test user to assign (a11-a20, check which are free)
   - What seed data is needed (users, preferences, responses, announcements, etc.)
   - Important: understand data relationships (e.g., preference → questionnaire topic filtering)

3. **Generate three files**:
   - `manifest.json` — metadata (id, title, user, description, status)
   - `steps.md` — detailed step-by-step instructions with completion criteria
   - `seed.ts` — database preparation script

4. **Test the seed**: Run the seed script to verify it works.

5. **Dry-run the steps**: Execute via agent-browser to validate the test case.

6. **Iterate**: If any step fails, adjust the seed/steps and re-run until the test case passes.

### Mode 3: Debug Failed Test

When a previously passing test case now fails:

1. Read the test case's `steps.md` to understand expected behavior.
2. Run the seed and execute the test to reproduce the failure.
3. Analyze whether the failure is due to:
   - **Code change**: The application behavior changed (likely a bug or intentional feature change)
   - **Data change**: Seed data no longer matches the system state (e.g., questionnaire structure changed)
   - **Test issue**: The test steps or expectations need updating
4. Report findings and recommend whether to fix the code or update the test.

## File Structure

```
e2e/uiqa/
├── README.md              # Framework docs + how to create new cases
├── shared/
│   └── db.ts              # Shared Prisma client + helper functions
├── Q-1/
│   ├── manifest.json      # { id, title, user, description, status }
│   ├── steps.md           # Detailed steps + completion criteria
│   └── seed.ts            # Data preparation script
├── Q-2/
│   └── ...
└── Q-N/
    └── ...
```

## manifest.json Schema

```json
{
  "id": "Q-1",
  "title": "新用户公告流程",
  "user": "a11",
  "description": "验证新注册用户的公告倒计时、关闭、以及重登录后公告行为",
  "tags": ["announcement", "new-user"],
  "status": "ready"
}
```

## Seed Script Pattern

All seed scripts follow the same pattern:

```typescript
import { getDb, resetUser, cleanup } from '../shared/db';

async function seed() {
  const { prisma } = await getDb();
  try {
    // 1. Reset or create test user
    const user = await resetUser(prisma, 'a11');

    // 2. Prepare test-specific data
    // ... (varies per test case)

    console.log('✅ Q-1 seed completed for user a11');
  } finally {
    await cleanup();
  }
}

seed();
```

## Key Data Relationships

When creating seeds that involve preferences and questionnaire:

1. **Preference → Topic mapping**: Each `Topic` has `preferenceCategorySlug` + `preferenceMode`
2. **Three display modes**:
   - `REPEAT`: Same template SubTopic repeated per preference selection (e.g., cities)
   - `FILTER`: Only show SubTopics matching user's preference selections
   - `CONTEXT`: Show all questions, display preference as contextual label
3. **14 Topics** in questionnaire v2, each mapped to one of 14 preference categories
4. **Announcement**: Only one active at a time, `AnnouncementView` tracks if user has seen it

## Important Notes

- Seeds are **destructive for the specific test user only** — they delete and recreate data for that user
- Seeds should NEVER modify data for other users or global system data (announcements, questionnaire structure)
- Test users a11-a20 are reserved exclusively for UIQA — do not use them for other purposes
- The staging URL uses sessionStorage for announcement dismissal — agent-browser sessions start fresh
- Login form has no minimum password length validation (only registration does), so short passwords work
