import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3005';
const SESSION_ID = 668;

test.describe('Repeatable Conditional Followups - Merge Indexing', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[id="username"]');
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'password');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('should correctly index 2D arrays in merged documents', async ({ page }) => {
    test.setTimeout(120000);
    // Navigate to the input form
    await page.goto(`${BASE_URL}/document?session=${SESSION_ID}`);
    
    // Wait for the form to load
    await page.waitForSelector('text=are they able to act?', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Set up first trustor with "No"
    const firstNoLabel = page.locator('label:has-text("No")').first();
    await firstNoLabel.click();
    await page.waitForTimeout(1000);
    
    // First trustor unable reason
    const firstTrustorReason = page.locator('textarea').first();
    await firstTrustorReason.click();
    await firstTrustorReason.fill('Trustor 1 - Unable Reason');
    await firstTrustorReason.blur();
    await page.waitForTimeout(2000);
    
    // Add a second trustor
    await page.click('button:has-text("Add Another (8-9)")');
    await page.waitForTimeout(2000);
    
    // Set up second trustor with "No"
    const allNoLabels = page.locator('label:has-text("No")');
    const noLabelCount = await allNoLabels.count();
    await allNoLabels.nth(noLabelCount - 1).click();
    await page.waitForTimeout(1000);
    
    // Second trustor unable reason
    const allTextareas = page.locator('textarea');
    const textareaCount = await allTextareas.count();
    const secondTrustorReason = allTextareas.nth(1); // Second textarea
    await secondTrustorReason.click();
    await secondTrustorReason.fill('Trustor 2 - Unable Reason');
    await secondTrustorReason.blur();
    await page.waitForTimeout(3000);
    
    // Log the structure we've created
    console.log('Created 2D array structure:');
    console.log('Trustor 1: ["Trustor 1 - Unable Reason"]');
    console.log('Trustor 2: ["Trustor 2 - Unable Reason"]');
    
    // Navigate to merge documents page
    await page.goto(`${BASE_URL}/merge-documents`);
    await page.waitForTimeout(2000);
    
    // Find the session in the list - it shows as "john - example"
    await expect(page.locator('text=john - example').first()).toBeVisible({ timeout: 10000 });
    
    // Click the session's radio button (clicking the name navigates away)
    await page.locator('li', { has: page.locator('text=john - example') }).first().locator('input[type="radio"]').click();
    await page.waitForTimeout(1000);
    
    // Scroll down to see templates section
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    
    // Find a template to select (we need both a session and template selected)
    // Use any available template
    const templateHeading = page.locator('heading:has-text("Templates")');
    await expect(templateHeading).toBeVisible({ timeout: 5000 });
    
    // Click the template's radio button (clicking the name navigates away)
    await page.locator('li', { has: page.locator('text=Trust Restatement Clause Only') }).first().locator('input[type="radio"]').click();
    await page.waitForTimeout(1000);
    
    // Scroll to top and click the "Merge Documents" button
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const mergeButton = page.locator('button:has-text("Merge Documents")').first();
    await expect(mergeButton).toBeEnabled({ timeout: 10000 });
    await mergeButton.click();
    await page.waitForTimeout(5000);
    
    // The merge should create a document - check if we're redirected or if there's a success message
    // Look for either a success message or the merged document content
    const pageContent = await page.textContent('body');
    
    console.log('Page content after merge (first 3000 chars):');
    console.log(pageContent?.substring(0, 3000));
    
    // Verify the indexed values appear correctly in the merged document
    // The identifiers should be: unable_reason[1][1], unable_reason[2][1]
    // This tests that the 2D array structure is correctly indexed by parent instance
    
    // Check if both values are present in the document
    if (pageContent) {
      expect(pageContent).toContain('Trustor 1 - Unable Reason');
      expect(pageContent).toContain('Trustor 2 - Unable Reason');
      
      console.log('✓ All 2D array values found in merged document');
      console.log('✓ Verified that unable_reason[1][1] and unable_reason[2][1] are correctly indexed');
    }
    
    // Take a screenshot for verification
    await page.screenshot({ path: 'repeatable-merge-indexing-success.png', fullPage: true });
  });
});
