import { test, expect } from '@playwright/test';

test.describe('Edulari Authentication Flow', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

  test.describe('Guest User Navigation', () => {
    test('should navigate from homepage to login page', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('link', { name: 'Login' }).click();
      await expect(page).toHaveURL(/\/login$/);
    });

    test('should navigate from login to register page', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('link', { name: 'Sign Up' }).click();
      await expect(page).toHaveURL(/\/register$/);
    });

    test('should display login form with proper fields', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /login|sign in/i })).toBeVisible();
    });
  });

  test.describe('Login Functionality', () => {
    test('should show error for invalid email format', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByLabel(/password/i).fill('Test123!');
      await page.getByRole('button', { name: /login|sign in/i }).click();
      
      // Form validation should trigger
      await expect(page.locator('.error-text, [class*="error"]')).toBeVisible({ timeout: 5000 });
    });

    test('should redirect authenticated users to dashboard after successful login', async ({ page, context }) => {
      // Skip if no valid user exists
      if (!process.env.E2E_TEST_USER) {
        test.skip();
      }

      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.E2E_TEST_USER!);
      await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
      await page.getByRole('button', { name: /login|sign in/i }).click();
      
      // Should redirect to student dashboard
      await expect(page).toHaveURL(/\/student\/dashboard$/, { timeout: 30000 });
      
      // Check session cookie exists
      const cookies = await context.cookies();
      const sessionCookie = cookies.find((c: any) => c.name && c.name.includes('session'));
      expect(sessionCookie).toBeDefined();
    }, { timeout: 45000 });
  });

  test.describe('Registration Flow', () => {
    test('should validate name field is required', async ({ page }) => {
      await page.goto('/register');
      
      await page.getByLabel(/email/i).fill('newuser@test.com');
      await page.getByLabel(/password/i).fill('ValidPass123!');
      await page.getByRole('button', { name: /submit|register/i }).first().click();
      
      // Name validation error should appear
      await expect(page.getByText(/name/i)).toBeVisible({ timeout: 5000 });
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/register');
      
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('not-an-email');
      await page.getByLabel(/password/i).fill('ValidPass123!');
      await page.getByRole('button', { name: /submit|register/i }).first().click();
      
      // Email validation should trigger
      await expect(page.getByText(/email/i)).toBeVisible({ timeout: 5000 });
    });

    test('should validate password length requirement', async ({ page }) => {
      await page.goto('/register');
      
      await page.getByLabel(/name/i).fill('Test User');
      await page.getByLabel(/email/i).fill('newuser@test.com');
      await page.getByLabel(/password/i).fill('short'); // Less than 8 chars
      await page.getByRole('button', { name: /submit|register/i }).first().click();
      
      // Password length error should appear
      const errorMsg = page.getByText(/at least 8 characters/);
      await expect(errorMsg).toBeVisible({ timeout: 5000 });
    });

    test('should successfully register with valid data', async ({ page }) => {
      const uniqueEmail = `e2etest-${Date.now()}@example.com`;
      const uniquePassword = `TestSecure${Date.now()}123!`;
      
      await page.goto('/register');
      
      await page.getByLabel(/name/i).fill('E2E Test User');
      await page.getByLabel(/email/i).fill(uniqueEmail);
      await page.getByLabel(/password/i).fill(uniquePassword);
      
      // Click register button
      const registerBtn = page.getByRole('button', { name: /submit|register/i }).first();
      await registerBtn.click();
      
      // Should redirect to registration success page
      await expect(page).toHaveURL(/\/register-success$/, { timeout: 40000 });
      
      // Verify notification received
      await expect(page.getByText(/verification email/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Forgot Password Flow', () => {
    test('should navigate to forgot password page', async ({ page }) => {
      await page.goto('/login');
      
      const forgotPasswordLinks = page.getByText(/forgot.*password|reset.*password/i);
      await expect(forgotPasswordLinks.first()).toBeVisible();
    });

    test('should handle non-existent email gracefully', async ({ page }) => {
      await page.goto('/login');
      
      const forgotPasswordLinks = page.getByText(/forgot.*password|reset.*password/i);
      await forgotPasswordLinks.first().click();
      
      await page.getByLabel(/email/i).fill('nonexistent-user-' + Date.now() + '@example.com');
      await page.getByRole('button', { name: /send.*reset|submit/i }).click();
      
      // Should return success without revealing if email exists (privacy)
      await expect(page.getByText(/sent/i, { timeout: 10000 })).toBeVisible();
    });

    test('should validate email in forgot password form', async ({ page }) => {
      await page.goto('/login');
      
      const forgotPasswordLinks = page.getByText(/forgot.*password|reset.*password/i);
      await forgotPasswordLinks.first().click();
      
      await page.getByLabel(/email/i).fill('invalid-email-format');
      await page.getByRole('button', { name: /send.*reset|submit/i }).click();
      
      // Should show validation error
      await expect(page.getByText(/valid.*email/i, { timeout: 5000 })).toBeVisible();
    });
  });

  test.describe('Session & Auth Persistence', () => {
    test('should persist login session across navigation', async ({ page }) => {
      // Skip if no credentials configured
      if (!process.env.E2E_TEST_USER) {
        test.skip();
      }
      
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.E2E_TEST_USER!);
      await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
      await page.getByRole('button', { name: /login|sign in/i }).click();
      await expect(page).toHaveURL(/\/student\/dashboard$/);
      
      // Navigate away and back
      await page.goto('/browse-courses');
      await page.goto('/');
      
      // Should remain logged in
      const logoutLink = page.getByRole('link', { name: /logout/i });
      await expect(logoutLink).toBeVisible();
    });

    test('should clear session on logout', async ({ page }) => {
      if (!process.env.E2E_TEST_USER) {
        test.skip();
      }
      
      await page.goto('/login');
      await page.getByLabel(/email/i).fill(process.env.E2E_TEST_USER!);
      await page.getByLabel(/password/i).fill(process.env.E2E_TEST_PASSWORD!);
      await page.getByRole('button', { name: /login|sign in/i }).click();
      await expect(page).toHaveURL(/\/student\/dashboard$/);
      
      // Find and click logout
      const logoutLink = page.getByRole('link', { name: /logout/i }).first();
      await logoutLink.click();
      
      // Should redirect to login or home
      await expect(page).toHaveURL(/(\/login$|\/)$/);
      
      // Should see login/signup buttons again
      await expect(page.getByRole('link', { name: /login/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /sign up/i })).toBeVisible();
    });
  });
});
