import { test, expect } from '@playwright/test';

test.describe('Repeatable Question Input Bug', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3005/login');
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'password');
    await page.click('button[type="submit"]');
    // Wait for navigation to complete
    await page.waitForTimeout(2000);
  });

  test('should maintain independent values for repeatable questions in different parent instances', async ({ page }) => {
    // Navigate to the input form with session 668
    await page.goto('http://localhost:3005/input-form?session=668');
    
    // Wait for the form to load
    await page.waitForSelector('text=are they able to act?');
    
    // Find the first trustor instance - select "No" to show conditional followups
    const firstTrustorNo = page.locator('label:has-text("No")').first();
    await firstTrustorNo.click();
    
    // Wait for the conditional followup to appear
    await page.waitForSelector('text=Why can\'t the trustor act?');
    
    // Find the first instance's "Why can't the trustor act?" textarea
    const firstUnableReason = page.locator('textarea').filter({ hasText: /^(noodle|dflknsdfnkldmf)?$/ }).first();
    
    // Type in the first instance
    await firstUnableReason.clear();
    await firstUnableReason.fill('first reason');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    
    // Wait a bit for state to settle
    await page.waitForTimeout(500);
    
    // Add another trustor
    await page.click('button:has-text("Add Another (8-9)")');
    await page.waitForTimeout(500);
    
    // Find the second trustor instance - select "No" to show conditional followups
    const allNoLabels = page.locator('label:has-text("No")');
    const noCount = await allNoLabels.count();
    await allNoLabels.nth(noCount - 1).click();
    
    // Wait for the second conditional followup to appear
    await page.waitForTimeout(500);
    
    // Find the second instance's "Why can't the trustor act?" textarea
    const secondUnableReason = page.locator('textarea').filter({ hasText: /^(noodle|dflknsdfnkldmf)?$/ }).first();
    
    // Type in the second instance
    await secondUnableReason.clear();
    await secondUnableReason.fill('second reason');
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    
    // Wait for state to settle
    await page.waitForTimeout(500);
    
    // Verify the first instance still has its original value
    const firstValue = await page.locator('textarea').filter({ hasText: 'first reason' }).first().inputValue();
    expect(firstValue).toBe('first reason');
    
    // Verify the second instance has its own value
    const secondValue = await page.locator('textarea').filter({ hasText: 'second reason' }).first().inputValue();
    expect(secondValue).toBe('second reason');
    
    console.log('First instance value:', firstValue);
    console.log('Second instance value:', secondValue);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'repeatable-input-test.png', fullPage: true });
  });
});
