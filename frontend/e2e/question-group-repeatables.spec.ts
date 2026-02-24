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
  test('should create and persist repeatable question state', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `Repeatable_${uniqueId}`;

    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    // Create new group
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
    await page.waitForTimeout(1000);

    // Make it repeatable
    const repeatableCheckbox = page.locator('.question-builder input[type="checkbox"]').first();
    await repeatableCheckbox.check();
    await page.waitForTimeout(2000);

    // Verify checkbox is checked
    expect(await repeatableCheckbox.isChecked()).toBe(true);

    // Refresh and verify repeatable state persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const repeatableCheckboxAfterRefresh = page.locator('.question-builder input[type="checkbox"]').first();
    expect(await repeatableCheckboxAfterRefresh.isChecked()).toBe(true);

    console.log('Repeatable test: checkbox state persisted correctly');
  });

  test('should toggle repeatable state on and off', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `ToggleRepeatable_${uniqueId}`;

    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    // Create new group
    await page.click('text=Create Questions Group');
    await page.waitForTimeout(500);

    const nameInput = page.locator('input.form-input').first();
    await nameInput.fill(groupName);
    await page.waitForTimeout(500);

    // Wait for name validation to complete
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
    await page.waitForTimeout(1000);

    // Initially not repeatable
    let repeatableCheckbox = page.locator('.question-builder input[type="checkbox"]').first();
    expect(await repeatableCheckbox.isChecked()).toBe(false);

    // Make it repeatable
    await repeatableCheckbox.check();
    await page.waitForTimeout(2000);
    expect(await repeatableCheckbox.isChecked()).toBe(true);

    // Refresh and verify it's repeatable
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    repeatableCheckbox = page.locator('.question-builder input[type="checkbox"]').first();
    expect(await repeatableCheckbox.isChecked()).toBe(true);

    // Toggle it off
    await repeatableCheckbox.uncheck();
    await page.waitForTimeout(2000);
    expect(await repeatableCheckbox.isChecked()).toBe(false);

    // Refresh and verify it's not repeatable
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    repeatableCheckbox = page.locator('.question-builder input[type="checkbox"]').first();
    expect(await repeatableCheckbox.isChecked()).toBe(false);

    console.log('Toggle repeatable test: state changes persisted correctly');
  });
});
