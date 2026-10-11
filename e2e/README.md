# Edulari E2E Test Suite

Comprehensive End-to-End test suite for Edulari using Playwright.

## Quick Start

### Prerequisites
1. Database configured with `.env.local` containing `DATABASE_URL`
2. Dev server running on port 3000 (will auto-start if not running)
3. Playwright browsers installed: `npx playwright install`

### Running Tests

**Run all tests:**
```bash
npm run test:e2e
```

**Run specific test file:**
```bash
npm run test:e2e -- auth.spec.ts
```

**Run in debug mode:**
```bash
npm run test:e2e:debug
```

**Run against specific browser:**
```bash
npm run test:e2e -- --project=chromium
```

**Generate HTML report:**
```bash
npm run test:e2e:report
```

## Test Coverage

### Core Features Tested

#### ✅ Authentication (`auth.spec.ts`)
- Guest user navigation to login/register pages
- Login form validation
- Error handling for invalid credentials
- Session persistence across navigation
- Logout functionality
- Registration flow validation
- Forgot password flow

### Planned Tests

#### 🔄 Course Management
- Browse courses with filters
- Search course functionality
- Course detail page navigation
- Category filtering
- Featured courses display

#### 📚 Learning Features
- Enroll in courses
- Access purchased content
- Certificate generation
- Progress tracking

#### 👥 Role-Based Access
- Student dashboard features
- Instructor course management
- Admin panel controls

## Setup & Configuration

### Environment Variables

Create `.env.local` or `.env.e2e` with:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Test User Credentials (optional - creates default users)
E2E_STUDENT_EMAIL=e2e-student@test.com
E2E_STUDENT_PASSWORD=TestPassword123!
E2E_INSTRUCTOR_EMAIL=e2e-instructor@test.com
E2E_INSTRUCTOR_PASSWORD=TestPassword123!
E2E_ADMIN_EMAIL=e2e-admin@test.com
E2E_ADMIN_PASSWORD=TestPassword123!

# Base URL for tests (default: http://localhost:3000)
BASE_URL=http://localhost:3000
```

### Seed Test Users

Before running authenticated tests, seed test users into your database:

```bash
npm run seed:e2e-users
```

This creates three test users:
1. **Student** (`e2e-student@test.com`)
2. **Instructor** (`e2e-instructor@test.com`)
3. **Admin** (`e2e-admin@test.com`)

Add these credentials to your `.env.local` for authentication tests.

## Project Structure

```
e2e/
├── auth.spec.ts              # Authentication flow tests
├── global-fixtures.ts        # Extended fixtures and helpers
├── playwright.config.ts      # Playwright configuration
├── fixtures/
│   ├── loginPage.ts          # LoginPage object model
│   └── coursePage.ts         # CoursePage object model
└── test-results/             # Generated test artifacts (gitignored)
```

### Page Object Models

Each major feature has its own page object class:

- **LoginPage**: All login-related locators and actions
- **CoursePage**: Browse/search/course detail interactions

Extend these by creating new fixture classes for additional features.

## Adding New Tests

### Create a New Test File

1. Create spec file in `e2e/` directory:
   ```typescript
   // e2e/my-feature.spec.ts
   import { test, expect } from '../global-fixtures';

   test.describe('My Feature', () => {
     test('should do something', async ({ page }) => {
       await page.goto('/my-feature');
       await expect(page.getByRole('heading')).toBeVisible();
     });
   });
   ```

2. Add page object if needed:
   ```typescript
   // e2e/fixtures/myFeaturePage.ts
   import { Page, Locator } from '@playwright/test';

   export class MyFeaturePage {
     private page: Page;
     
     constructor(page: Page) {
       this.page = page;
     }

     async goto(): Promise<void> {
       await this.page.goto('/my-feature');
     }
   }
   ```

3. Import and use in test:
   ```typescript
   import { MyFeaturePage } from './fixtures/myFeaturePage';

   test('should interact with feature', async ({ page }) => {
     const myFeature = new MyFeaturePage(page);
     await myFeature.goto();
     // ... test logic
   });
   ```

## Debugging Tips

### Interactive Debug Mode

```bash
npm run test:e2e:debug
```

This opens Playwright's Inspector where you can:
- Step through test execution
- View actual vs expected values
- Record new tests
- Inspect DOM snapshots

### Viewing Test Artifacts

After test runs complete:
- **Screenshots**: `test-results/` folder
- **Videos**: `test-results/` folder (on failure)
- **Traces**: `npm run test:e2e:trace` to open trace viewer

```bash
# Open HTML report
npm run test:e2e:report

# Open trace viewer for specific test
npx playwright show-trace test-results/<test-name>/trace.zip
```

### Console & Network Logging

Enable verbose logging:
```bash
DEBUG=pw:api npm run test:e2e
```

## CI/CD Integration

Add to your CI workflow:

```yaml
# Example GitHub Actions
- name: Install dependencies
  run: npm install && npx playwright install
  
- name: Run E2E tests
  env:
    E2E_TEST_USER: ${{ secrets.E2E_TEST_USER }}
    E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
  run: npm run test:e2e

- name: Upload test results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests Fail with Connection Errors

Ensure:
1. Database is running and accessible
2. `.env.local` has correct `DATABASE_URL`
3. Test users exist (run `npm run seed:e2e-users`)

### Tests Timeout

Increase timeout for specific tests:
```typescript
test('slow test', { timeout: 60000 }, async ({ page }) => {
  // ... slow operation
});
```

### Visual Regression Issues

Take screenshots at key points:
```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### Browser Not Found Error

Install Playwright browsers:
```bash
npx playwright install
```

## Performance

### Parallel Execution

Tests run in parallel by default. For faster feedback in CI:
```bash
npm run test:e2e -- --workers=4
```

### Skip Flaky Tests

Mark tests to skip:
```typescript
test.skip(process.env.CI, 'Flaky in CI environment');
```

## Contributing

When adding new test coverage:
1. Follow existing patterns (see `auth.spec.ts`)
2. Use descriptive test names
3. Include cleanup/setup steps
4. Update documentation if API changes
5. Ensure tests pass locally before committing

---

**Last Updated:** 2026-10-11  
**Version:** 1.0
