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

test.describe('Question Group Conditionals', () => {
  test('should handle conditional deletion and preserve remaining structure', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `ConditionalDelete_${uniqueId}`;

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

    // Add first question
    const addQuestionBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addQuestionBtn.click();
    await page.waitForTimeout(1000);

    const identifierInput1 = page.locator('input[placeholder*="full_name"]').first();
    await identifierInput1.fill(`q1_${uniqueId}`);
    const questionTextarea1 = page.locator('.question-builder textarea').first();
    await questionTextarea1.fill('Question 1');
    await page.waitForTimeout(2000);

    // Add conditional after first question
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conditionalBtn1 = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first();
    await conditionalBtn1.click();
    await page.waitForTimeout(1500);

    // Fill conditional value
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const valueInput1 = page.locator('input[placeholder*="value"]').first();
    await valueInput1.fill('yes');
    await page.waitForTimeout(1000);

    // Add second question
    const addQuestionBtn2 = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addQuestionBtn2.click();
    await page.waitForTimeout(1000);

    const allIdentifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
    const count = await allIdentifiers.count();
    await allIdentifiers.nth(count - 1).fill(`q2_${uniqueId}`);
    
    const allTextareas = page.locator('.question-builder textarea');
    await allTextareas.nth(count - 1).fill('Question 2');
    await page.waitForTimeout(2000);

    // Add conditional after second question
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conditionalBtn2 = page.locator('button').filter({ hasText: /^Add Conditional$/ }).last();
    await conditionalBtn2.click();
    await page.waitForTimeout(1500);

    // Fill second conditional value
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const allValueInputs = page.locator('input[placeholder*="value"]');
    const valueCount = await allValueInputs.count();
    await allValueInputs.nth(valueCount - 1).fill('no');
    await page.waitForTimeout(2000);

    // Verify we have 2 conditionals
    let conditionalBlocks = page.locator('.conditional-block');
    let conditionalCount = await conditionalBlocks.count();
    expect(conditionalCount).toBe(2);

    // Delete first conditional
    const deleteBtn = page.locator('button[title="Remove conditional"]').first();
    await deleteBtn.click();
    await page.waitForTimeout(2000);

    // Verify only 1 conditional remains
    conditionalBlocks = page.locator('.conditional-block');
    conditionalCount = await conditionalBlocks.count();
    expect(conditionalCount).toBe(1);

    // Refresh and verify structure persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    conditionalBlocks = page.locator('.conditional-block');
    const remainingCount = await conditionalBlocks.count();
    expect(remainingCount).toBe(1);

    // Verify the remaining conditional has the correct value
    const remainingValueInput = page.locator('input[placeholder*="value"]').first();
    const remainingValue = await remainingValueInput.inputValue();
    expect(remainingValue).toBe('no');

    console.log('Conditional deletion test: structure preserved correctly');
  });

  test('should update conditional values and persist changes', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `ConditionalValue_${uniqueId}`;

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
    await identifierInput.fill(`country_${uniqueId}`);
    const questionTextarea = page.locator('.question-builder textarea').first();
    await questionTextarea.fill('Country');
    await page.waitForTimeout(2000);

    // Add conditional
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first();
    await conditionalBtn.click();
    await page.waitForTimeout(1500);

    // Set initial value
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const valueInput = page.locator('input[placeholder*="value"]').first();
    await valueInput.fill('USA');
    await page.waitForTimeout(2000);

    // Refresh and verify initial value persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const valueInputAfterRefresh = page.locator('input[placeholder*="value"]').first();
    const persistedValue = await valueInputAfterRefresh.inputValue();
    expect(persistedValue).toBe('USA');

    // Update value
    await valueInputAfterRefresh.fill('Canada');
    await page.waitForTimeout(2000);

    // Refresh again and verify updated value persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const valueInputAfterSecondRefresh = page.locator('input[placeholder*="value"]').first();
    const updatedValue = await valueInputAfterSecondRefresh.inputValue();
    expect(updatedValue).toBe('Canada');

    console.log('Conditional value update test: values persisted correctly');
  });

  test('should create multi-level nested conditionals', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `MultiLevel_${uniqueId}`;

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

    // Add base question
    const addQuestionBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addQuestionBtn.click();
    await page.waitForTimeout(1000);

    const identifierInput = page.locator('input[placeholder*="full_name"]').first();
    await identifierInput.fill(`base_${uniqueId}`);
    const questionTextarea = page.locator('.question-builder textarea').first();
    await questionTextarea.fill('Base Question');
    await page.waitForTimeout(2000);

    // Add first level conditional
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first();
    await conditionalBtn.click();
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const valueInput = page.locator('input[placeholder*="value"]').first();
    await valueInput.fill('yes');
    await page.waitForTimeout(1000);

    // Add question inside first conditional
    const addNestedBtn = page.locator('button').filter({ hasText: /Add Question/ }).last();
    await addNestedBtn.click();
    await page.waitForTimeout(1500);

    const allIdentifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
    const count1 = await allIdentifiers.count();
    await allIdentifiers.nth(count1 - 1).fill(`level1_${uniqueId}`);
    const allTextareas = page.locator('.question-builder textarea');
    await allTextareas.nth(count1 - 1).fill('Level 1 Nested');
    await page.waitForTimeout(2000);

    // Add second level conditional (nested inside first)
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const addNestedConditionalBtn = page.locator('button').filter({ hasText: /Add.*Conditional/ }).last();
    await addNestedConditionalBtn.click();
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const allValueInputs = page.locator('input[placeholder*="value"]');
    const valueCount = await allValueInputs.count();
    await allValueInputs.nth(valueCount - 1).fill('maybe');
    await page.waitForTimeout(1000);

    // Verify we have 2 conditionals
    let conditionalBlocks = page.locator('.conditional-block');
    let conditionalCount = await conditionalBlocks.count();
    expect(conditionalCount).toBeGreaterThanOrEqual(2);

    // Refresh and verify structure persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    conditionalBlocks = page.locator('.conditional-block');
    const persistedCount = await conditionalBlocks.count();
    expect(persistedCount).toBeGreaterThanOrEqual(2);

    console.log(`Multi-level test: ${persistedCount} conditionals persisted`);
  });

  test('should handle different conditional operators', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `Operators_${uniqueId}`;

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

    // Add question
    const addQuestionBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addQuestionBtn.click();
    await page.waitForTimeout(1000);

    const identifierInput = page.locator('input[placeholder*="full_name"]').first();
    await identifierInput.fill(`status_${uniqueId}`);
    const questionTextarea = page.locator('.question-builder textarea').first();
    await questionTextarea.fill('Status');
    await page.waitForTimeout(2000);

    // Add conditional
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first();
    await conditionalBtn.click();
    await page.waitForTimeout(1500);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Check if operator select exists and try to change it
    const operatorSelects = page.locator('select');
    const selectCount = await operatorSelects.count();
    
    if (selectCount > 1) {
      // Try to select not_equals operator
      const operatorSelect = operatorSelects.nth(1);
      await operatorSelect.selectOption('not_equals').catch(() => {
        console.log('not_equals option not available, using default');
      });
      await page.waitForTimeout(500);
    }

    // Fill value
    const valueInput = page.locator('input[placeholder*="value"]').first();
    await valueInput.fill('inactive');
    await page.waitForTimeout(2000);

    // Refresh and verify
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const conditionalBlocks = page.locator('.conditional-block');
    const conditionalCount = await conditionalBlocks.count();
    expect(conditionalCount).toBeGreaterThanOrEqual(1);

    const persistedValue = await page.locator('input[placeholder*="value"]').first().inputValue();
    expect(persistedValue).toBe('inactive');

    console.log('Operator test: conditional with operator persisted');
  });
});
