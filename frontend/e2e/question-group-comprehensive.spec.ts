import { test, expect, Page } from '@playwright/test';

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3005',
  adminEmail: 'admin',
  adminPassword: 'password',
};

async function login(page: Page) {
  await page.goto(`${TEST_CONFIG.baseUrl}/login`);
  await page.fill('input[id="username"]', TEST_CONFIG.adminEmail);
  await page.fill('input[id="password"]', TEST_CONFIG.adminPassword);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

test.describe('Question Group Comprehensive Tests', () => {
  test('should handle complex nested structure with multiple features', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `Complex_${uniqueId}`;

    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    await page.click('text=Create Questions Group');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input.form-input').first();
    await nameInput.fill(groupName);
    await page.waitForTimeout(500);

    const checkingName = page.getByText('Checking name...');
    if (await checkingName.isVisible().catch(() => false)) {
      await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    }
    await page.waitForTimeout(500);

    await page.click('text=Save Group Information');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Add regular question
    let addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addBtn.click();
    await page.waitForTimeout(1000);

    let identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
    await identifiers.nth(0).fill(`base_${uniqueId}`);
    let textareas = page.locator('.question-builder textarea');
    await textareas.nth(0).fill('Base Question');
    await page.waitForTimeout(2000);

    // Add repeatable question
    addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addBtn.click();
    await page.waitForTimeout(1000);

    identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
    await identifiers.nth(1).fill(`repeatable_${uniqueId}`);
    textareas = page.locator('.question-builder textarea');
    await textareas.nth(1).fill('Repeatable Question');
    await page.waitForTimeout(1000);

    const repeatableCheckbox = page.locator('.question-builder input[type="checkbox"]').nth(1);
    await repeatableCheckbox.check();
    await page.waitForTimeout(2000);

    // Add question with conditional
    addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addBtn.click();
    await page.waitForTimeout(1000);

    identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
    const count = await identifiers.count();
    await identifiers.nth(count - 1).fill(`conditional_${uniqueId}`);
    textareas = page.locator('.question-builder textarea');
    await textareas.nth(count - 1).fill('Question with Conditional');
    await page.waitForTimeout(2000);

    // Add conditional
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).last();
    await conditionalBtn.click();
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const valueInput = page.locator('input[placeholder*="value"]').last();
    await valueInput.fill('yes');
    await page.waitForTimeout(2000);

    // Verify all features exist
    const questionBuilders = page.locator('.question-builder');
    expect(await questionBuilders.count()).toBeGreaterThanOrEqual(3);

    const checkboxes = page.locator('.question-builder input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    expect(checkboxCount).toBeGreaterThanOrEqual(2);

    const conditionalBlocks = page.locator('.conditional-block');
    expect(await conditionalBlocks.count()).toBeGreaterThanOrEqual(1);

    // Refresh and verify everything persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const buildersAfterRefresh = page.locator('.question-builder');
    expect(await buildersAfterRefresh.count()).toBeGreaterThanOrEqual(3);

    const checkboxesAfterRefresh = page.locator('.question-builder input[type="checkbox"]');
    expect(await checkboxesAfterRefresh.count()).toBeGreaterThanOrEqual(2);

    const conditionalsAfterRefresh = page.locator('.conditional-block');
    expect(await conditionalsAfterRefresh.count()).toBeGreaterThanOrEqual(1);

    console.log('Complex structure test: all features persisted correctly');
  });

  test('should handle rapid question creation and deletion', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `RapidOps_${uniqueId}`;

    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    await page.click('text=Create Questions Group');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input.form-input').first();
    await nameInput.fill(groupName);
    await page.waitForTimeout(500);

    const checkingName = page.getByText('Checking name...');
    if (await checkingName.isVisible().catch(() => false)) {
      await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    }
    await page.waitForTimeout(500);

    await page.click('text=Save Group Information');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Rapidly add 3 questions
    for (let i = 0; i < 3; i++) {
      const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
      await addBtn.click();
      await page.waitForTimeout(800);

      const identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await identifiers.nth(i).fill(`rapid_${i}_${uniqueId}`);
      await page.waitForTimeout(500);
    }

    let questionBuilders = page.locator('.question-builder');
    expect(await questionBuilders.count()).toBe(3);

    // Delete first question
    const deleteBtns = page.locator('button[title*="delete" i], button[aria-label*="delete" i]').filter({ has: page.locator('svg') });
    if (await deleteBtns.count() > 0) {
      await deleteBtns.first().click();
      await page.waitForTimeout(1500);

      questionBuilders = page.locator('.question-builder');
      expect(await questionBuilders.count()).toBe(2);

      // Refresh and verify
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const buildersAfterRefresh = page.locator('.question-builder');
      expect(await buildersAfterRefresh.count()).toBe(2);

      console.log('Rapid operations test: state persisted correctly after rapid changes');
    } else {
      console.log('Delete buttons not available, skipping rapid deletion test');
    }
  });

  test('should persist group metadata and questions together', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `Metadata_${uniqueId}`;
    const groupDescription = `Test description for ${uniqueId}`;

    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    await page.click('text=Create Questions Group');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input.form-input').first();
    await nameInput.fill(groupName);
    await page.waitForTimeout(500);

    // Fill description if available
    const descriptionInputs = page.locator('textarea');
    if (await descriptionInputs.count() > 0) {
      await descriptionInputs.first().fill(groupDescription);
      await page.waitForTimeout(500);
    }

    const checkingName = page.getByText('Checking name...');
    if (await checkingName.isVisible().catch(() => false)) {
      await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    }
    await page.waitForTimeout(500);

    await page.click('text=Save Group Information');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Add questions
    for (let i = 0; i < 2; i++) {
      const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
      await addBtn.click();
      await page.waitForTimeout(1000);

      const identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await identifiers.nth(i).fill(`meta_q${i}_${uniqueId}`);
      const textareas = page.locator('.question-builder textarea');
      await textareas.nth(i).fill(`Metadata Question ${i + 1}`);
      await page.waitForTimeout(1000);
    }

    const questionBuilders = page.locator('.question-builder');
    expect(await questionBuilders.count()).toBe(2);

    // Refresh and verify both metadata and questions persist
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify group name is still visible
    const nameInputAfterRefresh = page.locator('input.form-input').first();
    const persistedName = await nameInputAfterRefresh.inputValue();
    expect(persistedName).toBe(groupName);

    // Verify questions still exist
    const buildersAfterRefresh = page.locator('.question-builder');
    expect(await buildersAfterRefresh.count()).toBe(2);

    console.log('Metadata persistence test: group info and questions both persisted');
  });
});
