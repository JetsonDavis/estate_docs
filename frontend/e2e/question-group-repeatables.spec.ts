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

test.describe('Question Group Repeatables', () => {
  test('should display repeatable checkbox for questions', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `Repeatable_${uniqueId}`;

    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    await page.click('text=Create Questions Group');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input.form-input').first();
    await nameInput.fill(groupName);
    await page.waitForTimeout(500);

    // Wait for name validation to complete
    const checkingName = page.getByText('Checking name...');
    if (await checkingName.isVisible().catch(() => false)) {
      await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    }
    await page.waitForTimeout(500);

    await page.click('text=Save Group Information');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Add question
    const addQuestionBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addQuestionBtn.click();
    await page.waitForTimeout(1000);

    const identifierInput = page.locator('input[placeholder*="full_name"]').first();
    await identifierInput.fill(`person_${uniqueId}`);
    const questionTextarea = page.locator('.question-builder textarea').first();
    await questionTextarea.fill('Person Name');
    await page.waitForTimeout(2000);

    // Verify repeatable checkbox exists
    const repeatableCheckbox = page.locator('.question-builder input[type="checkbox"]').first();
    expect(await repeatableCheckbox.isVisible()).toBe(true);

    // Can be checked
    await repeatableCheckbox.check();
    await page.waitForTimeout(1000);
    expect(await repeatableCheckbox.isChecked()).toBe(true);

    console.log('Repeatable checkbox test: checkbox is functional');
  });

  test('should toggle repeatable checkbox state', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `ToggleRepeatable_${uniqueId}`;

    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    await page.click('text=Create Questions Group');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input.form-input').first();
    await nameInput.fill(groupName);
    await page.waitForTimeout(500);

    const checkingName2 = page.getByText('Checking name...');
    if (await checkingName2.isVisible().catch(() => false)) {
      await checkingName2.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    }
    await page.waitForTimeout(500);

    await page.click('text=Save Group Information');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Add question
    const addQuestionBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addQuestionBtn.click();
    await page.waitForTimeout(1000);

    const identifierInput = page.locator('input[placeholder*="full_name"]').first();
    await identifierInput.fill(`item_${uniqueId}`);
    const questionTextarea = page.locator('.question-builder textarea').first();
    await questionTextarea.fill('Item Name');
    await page.waitForTimeout(2000);

    // Initially not repeatable
    const repeatableCheckbox = page.locator('.question-builder input[type="checkbox"]').first();
    expect(await repeatableCheckbox.isChecked()).toBe(false);

    // Make it repeatable
    await repeatableCheckbox.check();
    await page.waitForTimeout(1000);
    expect(await repeatableCheckbox.isChecked()).toBe(true);

    // Toggle it off
    await repeatableCheckbox.uncheck();
    await page.waitForTimeout(1000);
    expect(await repeatableCheckbox.isChecked()).toBe(false);

    console.log('Toggle repeatable test: checkbox can be toggled on and off');
  });

  test('should display checkboxes for multiple questions', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `MultiCheckbox_${uniqueId}`;

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

    // Add 3 questions
    for (let i = 0; i < 3; i++) {
      const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
      await addBtn.click();
      await page.waitForTimeout(1000);

      const identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await identifiers.nth(i).fill(`q${i}_${uniqueId}`);
      const textareas = page.locator('.question-builder textarea');
      await textareas.nth(i).fill(`Question ${i + 1}`);
      await page.waitForTimeout(1000);
    }

    // Verify all questions have checkboxes
    const questionBuilders = page.locator('.question-builder');
    expect(await questionBuilders.count()).toBe(3);

    for (let i = 0; i < 3; i++) {
      const checkbox = questionBuilders.nth(i).locator('input[type="checkbox"]').first();
      expect(await checkbox.isVisible()).toBe(true);
    }

    console.log('Multi checkbox test: all questions have repeatable checkboxes');
  });

  test('should handle repeatable question with conditional', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `RepeatableConditional_${uniqueId}`;

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

    // Add repeatable question
    const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addBtn.click();
    await page.waitForTimeout(1000);

    const identifierInput = page.locator('input[placeholder*="full_name"]').first();
    await identifierInput.fill(`dependent_${uniqueId}`);
    const questionTextarea = page.locator('.question-builder textarea').first();
    await questionTextarea.fill('Dependent Name');
    await page.waitForTimeout(1000);

    // Make it repeatable
    const repeatableCheckbox = page.locator('.question-builder input[type="checkbox"]').first();
    await repeatableCheckbox.check();
    await page.waitForTimeout(2000);

    // Add conditional
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first();
    await conditionalBtn.click();
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const valueInput = page.locator('input[placeholder*="value"]').first();
    await valueInput.fill('yes');
    await page.waitForTimeout(2000);

    // Verify both repeatable and conditional exist
    expect(await repeatableCheckbox.isChecked()).toBe(true);
    
    const conditionalBlocks = page.locator('.conditional-block');
    expect(await conditionalBlocks.count()).toBeGreaterThanOrEqual(1);

    // Refresh and verify both persist
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const repeatableCheckboxAfterRefresh = page.locator('.question-builder input[type="checkbox"]').first();
    expect(await repeatableCheckboxAfterRefresh.isChecked()).toBe(true);

    const conditionalBlocksAfterRefresh = page.locator('.conditional-block');
    expect(await conditionalBlocksAfterRefresh.count()).toBeGreaterThanOrEqual(1);

    console.log('Repeatable with conditional test: both features persisted correctly');
  });
});
