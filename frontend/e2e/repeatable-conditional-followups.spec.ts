import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3005';
const SESSION_ID = 668;

test.describe('Repeatable Conditional Followups', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[id="username"]');
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'password');
    await page.click('button:has-text("Sign in")');
    // Wait for successful login - should redirect away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('should maintain independent values for repeatable questions in different parent instances across page refreshes', async ({ page }) => {
    // Navigate to the input form
    await page.goto(`${BASE_URL}/document?session=${SESSION_ID}`);
    
    // Wait for the form to load
    await page.waitForSelector('text=are they able to act?', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Ensure "No" is selected for the first trustor (it may already be)
    const firstNoRadio = page.locator('label:has-text("No")').first();
    await firstNoRadio.click();
    await page.waitForTimeout(1000);
    
    // Verify the conditional followup appears
    await expect(page.locator('text=Why can\'t the trustor act?').first()).toBeVisible();
    
    // Clear and type in the first trustor's "Why can't the trustor act?" field
    const firstUnableReason = page.locator('textarea').first();
    await firstUnableReason.click();
    await firstUnableReason.fill('');
    await firstUnableReason.fill('First trustor reason');
    await firstUnableReason.blur();
    await page.waitForTimeout(2000);
    
    // Add a second trustor
    await page.click('button:has-text("Add Another (8–9)")');
    await page.waitForTimeout(2000);
    
    // Find the second trustor's "are they able to act?" question and select "No"
    const allNoLabels = page.locator('label:has-text("No")');
    const noLabelCount = await allNoLabels.count();
    await allNoLabels.nth(noLabelCount - 1).click();
    await page.waitForTimeout(1000);
    
    // Verify the second conditional followup appears
    const whyTexts = page.locator('text=Why can\'t the trustor act?');
    await expect(whyTexts.nth(1)).toBeVisible({ timeout: 5000 });
    
    // Type in the second trustor's "Why can't the trustor act?" field
    const allTextareas = page.locator('textarea');
    const textareaCount = await allTextareas.count();
    const secondUnableReason = allTextareas.nth(1); // Second textarea
    await secondUnableReason.click();
    await secondUnableReason.fill('');
    await secondUnableReason.fill('Second trustor reason');
    await secondUnableReason.blur();
    await page.waitForTimeout(3000);
    
    // Verify both values are correct before refresh
    const firstValue = await firstUnableReason.inputValue();
    const secondValue = await secondUnableReason.inputValue();
    
    console.log('Before refresh - First value:', firstValue);
    console.log('Before refresh - Second value:', secondValue);
    
    expect(firstValue).toBe('First trustor reason');
    expect(secondValue).toBe('Second trustor reason');
    
    // Refresh the page
    await page.reload();
    await page.waitForSelector('text=are they able to act?', { timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Verify both conditional followups are still visible
    await expect(page.locator('text=Why can\'t the trustor act?').first()).toBeVisible();
    await expect(page.locator('text=Why can\'t the trustor act?').nth(1)).toBeVisible();
    
    // Get the textareas again after refresh
    const firstUnableReasonAfterRefresh = page.locator('textarea').first();
    const secondUnableReasonAfterRefresh = page.locator('textarea').nth(1);
    
    // Get values after refresh
    const firstValueAfterRefresh = await firstUnableReasonAfterRefresh.inputValue();
    const secondValueAfterRefresh = await secondUnableReasonAfterRefresh.inputValue();
    
    console.log('After refresh - First value:', firstValueAfterRefresh);
    console.log('After refresh - Second value:', secondValueAfterRefresh);
    
    // Verify values persisted correctly
    expect(firstValueAfterRefresh).toBe('First trustor reason');
    expect(secondValueAfterRefresh).toBe('Second trustor reason');
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'repeatable-conditional-test-success.png', fullPage: true });
  });
});
