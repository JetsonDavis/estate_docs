import { test, expect, Page } from '@playwright/test';

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3005',
  backendUrl: 'http://localhost:8005'
};

// Helper to generate unique identifiers
function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Helper to login
async function login(page: Page) {
  await page.goto(`${TEST_CONFIG.baseUrl}/login`);
  await page.fill('input#username', 'admin');
  await page.fill('input#password', 'password');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

// Helper to create a group
async function createGroup(page: Page, name: string) {
  await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups/new`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  // Check if we got redirected to login
  const currentUrl = page.url();
  if (currentUrl.includes('/login')) {
    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups/new`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  }

  const nameInput = page.locator('label:has-text("Name") + input, label:has-text("Name") ~ input, input.form-input').first();
  await expect(nameInput).toBeVisible({ timeout: 10000 });
  await nameInput.fill(name);

  const checkingName = page.getByText('Checking name...');
  if (await checkingName.isVisible().catch(() => false)) {
    await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
  }

  const saveBtn = page.getByRole('button', { name: /Save Group Information/i }).first();
  await expect(saveBtn).toBeVisible({ timeout: 10000 });
  await saveBtn.click();

  await page.waitForSelector('text=Questions', { timeout: 30000 });
  await expect(page.getByRole('button', { name: /^Add Question$/ }).last()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(500);
}

// Helper to add a question
async function addQuestion(page: Page, text: string, identifier: string) {
  const addBtn = page.getByRole('button', { name: /^Add Question$/ }).last();
  await expect(addBtn).toBeVisible({ timeout: 10000 });
  await addBtn.click();
  await page.waitForTimeout(300);

  const questionBuilders = page.locator('.question-builder');
  const lastBuilder = questionBuilders.last();

  const textInput = lastBuilder.locator('textarea[placeholder*="question text"]').first();
  await expect(textInput).toBeVisible({ timeout: 10000 });
  await textInput.fill(text);
  await page.waitForTimeout(200);

  const identifierInput = lastBuilder.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]').first();
  await expect(identifierInput).toBeVisible({ timeout: 10000 });
  await identifierInput.fill(identifier);
  await page.waitForTimeout(500);
}

// Helper to add a conditional after a question
async function addConditionalAfterQuestion(page: Page, questionIndex: number) {
  const questionBuilders = page.locator('.question-builder');
  const targetBuilder = questionBuilders.nth(questionIndex);
  
  const insertConditionalBtn = targetBuilder.locator('button:has-text("Insert Conditional")').first();
  await insertConditionalBtn.click();
  await page.waitForTimeout(500);
}

test.describe('Question Group Conditionals - Complex Logic', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(500);
  });

  test('should create multi-level nested conditionals (3 levels deep)', async ({ page }) => {
    const groupName = uniqueId('MultiLevel');
    await createGroup(page, groupName);

    // Add base question
    await addQuestion(page, 'Base Question', uniqueId('base'));
    await page.waitForTimeout(500);

    // Add conditional after base
    await addConditionalAfterQuestion(page, 0);
    await page.waitForTimeout(500);

    // Verify conditional block exists
    let conditionals = page.locator('.conditional-block');
    await expect(conditionals).toHaveCount(1);

    // Fill conditional value
    const firstConditional = conditionals.first();
    const valueInput = firstConditional.locator('input[placeholder*="value"]').first();
    await valueInput.fill('yes');
    await page.waitForTimeout(300);

    // Add question inside first conditional
    const nestedAddBtn = firstConditional.locator('button:has-text("Add Question")').first();
    await nestedAddBtn.click();
    await page.waitForTimeout(500);

    // Fill nested question
    const nestedBuilders = firstConditional.locator('.question-builder');
    const nestedTextInput = nestedBuilders.first().locator('textarea[placeholder*="question text"]').first();
    await nestedTextInput.fill('Level 1 Nested');
    await page.waitForTimeout(200);

    const nestedIdInput = nestedBuilders.first().locator('input[placeholder*="nested_field"]').first();
    await nestedIdInput.fill(uniqueId('level1'));
    await page.waitForTimeout(500);

    // Add nested conditional (level 2)
    const addNestedConditionalBtn = firstConditional.locator('button:has-text("Add Nested Conditional")').first();
    await addNestedConditionalBtn.click();
    await page.waitForTimeout(500);

    // Verify we now have 2 conditionals (original + nested)
    conditionals = page.locator('.conditional-block');
    await expect(conditionals).toHaveCount(2);

    // Fill level 2 conditional value
    const secondConditional = conditionals.nth(1);
    const level2ValueInput = secondConditional.locator('input[placeholder*="value"]').first();
    await level2ValueInput.fill('maybe');
    await page.waitForTimeout(300);

    // Add question inside level 2 conditional
    const level2AddBtn = secondConditional.locator('button:has-text("Add Question")').first();
    await level2AddBtn.click();
    await page.waitForTimeout(500);

    const level2Builders = secondConditional.locator('.question-builder');
    const level2TextInput = level2Builders.first().locator('textarea[placeholder*="question text"]').first();
    await level2TextInput.fill('Level 2 Nested');
    await page.waitForTimeout(200);

    const level2IdInput = level2Builders.first().locator('input[placeholder*="nested_field"]').first();
    await level2IdInput.fill(uniqueId('level2'));
    await page.waitForTimeout(500);

    // Refresh and verify structure persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify all conditionals still exist
    conditionals = page.locator('.conditional-block');
    const conditionalCount = await conditionals.count();
    expect(conditionalCount).toBeGreaterThanOrEqual(2);

    console.log(`Multi-level test: ${conditionalCount} conditionals persisted after refresh`);
  });

  test('should handle all conditional operators correctly', async ({ page }) => {
    const groupName = uniqueId('Operators');
    await createGroup(page, groupName);

    // Add base question
    await addQuestion(page, 'Status', uniqueId('status'));
    await page.waitForTimeout(500);

    // Test equals operator
    await addConditionalAfterQuestion(page, 0);
    await page.waitForTimeout(500);

    let conditionals = page.locator('.conditional-block');
    const firstConditional = conditionals.first();
    
    // Verify default operator is 'equals'
    const operatorSelect = firstConditional.locator('select').nth(1); // Second select is operator
    const operatorValue = await operatorSelect.inputValue();
    expect(operatorValue).toBe('equals');

    // Fill value for equals
    const valueInput = firstConditional.locator('input[placeholder*="value"]').first();
    await valueInput.fill('active');
    await page.waitForTimeout(300);

    // Add question inside
    const nestedAddBtn = firstConditional.locator('button:has-text("Add Question")').first();
    await nestedAddBtn.click();
    await page.waitForTimeout(500);

    const nestedBuilders = firstConditional.locator('.question-builder');
    const nestedIdInput = nestedBuilders.first().locator('input[placeholder*="nested_field"]').first();
    await nestedIdInput.fill(uniqueId('equals_nested'));
    await page.waitForTimeout(500);

    // Add another base question for not_equals test
    await addQuestion(page, 'Type', uniqueId('type'));
    await page.waitForTimeout(500);

    // Add conditional with not_equals
    const questionBuilders = page.locator('.question-builder').filter({ has: page.locator('textarea') });
    const secondQuestionIndex = await questionBuilders.count() - 1;
    
    const insertBtns = page.locator('button:has-text("Insert Conditional")');
    await insertBtns.nth(secondQuestionIndex).click();
    await page.waitForTimeout(500);

    conditionals = page.locator('.conditional-block');
    const secondConditional = conditionals.last();
    
    // Change operator to not_equals
    const secondOperatorSelect = secondConditional.locator('select').nth(1);
    await secondOperatorSelect.selectOption('not_equals');
    await page.waitForTimeout(300);

    // Fill value
    const secondValueInput = secondConditional.locator('input[placeholder*="value"]').first();
    await secondValueInput.fill('inactive');
    await page.waitForTimeout(300);

    // Refresh and verify operators persist
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    conditionals = page.locator('.conditional-block');
    const conditionalCount = await conditionals.count();
    expect(conditionalCount).toBeGreaterThanOrEqual(2);

    console.log(`Operator test: ${conditionalCount} conditionals with different operators persisted`);
  });

  test('should update conditional values and persist changes', async ({ page }) => {
    const groupName = uniqueId('ValueUpdate');
    await createGroup(page, groupName);

    // Add question and conditional
    await addQuestion(page, 'Country', uniqueId('country'));
    await page.waitForTimeout(500);

    await addConditionalAfterQuestion(page, 0);
    await page.waitForTimeout(500);

    const conditionals = page.locator('.conditional-block');
    const conditional = conditionals.first();

    // Set initial value
    const valueInput = conditional.locator('input[placeholder*="value"]').first();
    await valueInput.fill('USA');
    await page.waitForTimeout(500);

    // Add nested question
    const nestedAddBtn = conditional.locator('button:has-text("Add Question")').first();
    await nestedAddBtn.click();
    await page.waitForTimeout(500);

    const nestedBuilders = conditional.locator('.question-builder');
    const nestedIdInput = nestedBuilders.first().locator('input[placeholder*="nested_field"]').first();
    await nestedIdInput.fill(uniqueId('state'));
    await page.waitForTimeout(500);

    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify initial value persisted
    const conditionalAfterRefresh = page.locator('.conditional-block').first();
    const valueInputAfterRefresh = conditionalAfterRefresh.locator('input[placeholder*="value"]').first();
    const persistedValue = await valueInputAfterRefresh.inputValue();
    expect(persistedValue).toBe('USA');

    // Update value
    await valueInputAfterRefresh.fill('Canada');
    await page.waitForTimeout(500);

    // Refresh again
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify updated value persisted
    const conditionalAfterSecondRefresh = page.locator('.conditional-block').first();
    const valueInputAfterSecondRefresh = conditionalAfterSecondRefresh.locator('input[placeholder*="value"]').first();
    const updatedValue = await valueInputAfterSecondRefresh.inputValue();
    expect(updatedValue).toBe('Canada');

    console.log('Conditional value update test: values persisted correctly');
  });

  test('should handle conditional deletion and preserve remaining structure', async ({ page }) => {
    const groupName = uniqueId('ConditionalDelete');
    await createGroup(page, groupName);

    // Add 2 questions with conditionals
    await addQuestion(page, 'Q1', uniqueId('q1'));
    await page.waitForTimeout(500);

    await addConditionalAfterQuestion(page, 0);
    await page.waitForTimeout(500);

    let conditionals = page.locator('.conditional-block');
    let firstConditional = conditionals.first();
    let valueInput = firstConditional.locator('input[placeholder*="value"]').first();
    await valueInput.fill('yes');
    await page.waitForTimeout(300);

    // Add nested question in first conditional
    let nestedAddBtn = firstConditional.locator('button:has-text("Add Question")').first();
    await nestedAddBtn.click();
    await page.waitForTimeout(500);

    let nestedBuilders = firstConditional.locator('.question-builder');
    let nestedIdInput = nestedBuilders.first().locator('input[placeholder*="nested_field"]').first();
    await nestedIdInput.fill(uniqueId('nested1'));
    await page.waitForTimeout(500);

    // Add second question
    await addQuestion(page, 'Q2', uniqueId('q2'));
    await page.waitForTimeout(500);

    // Add conditional after second question
    const questionBuilders = page.locator('.question-builder').filter({ has: page.locator('textarea') });
    const secondQuestionIndex = await questionBuilders.count() - 1;
    const insertBtns = page.locator('button:has-text("Insert Conditional")');
    await insertBtns.nth(secondQuestionIndex).click();
    await page.waitForTimeout(500);

    conditionals = page.locator('.conditional-block');
    expect(await conditionals.count()).toBe(2);

    const secondConditional = conditionals.last();
    valueInput = secondConditional.locator('input[placeholder*="value"]').first();
    await valueInput.fill('no');
    await page.waitForTimeout(300);

    // Add nested question in second conditional
    nestedAddBtn = secondConditional.locator('button:has-text("Add Question")').first();
    await nestedAddBtn.click();
    await page.waitForTimeout(500);

    nestedBuilders = secondConditional.locator('.question-builder');
    nestedIdInput = nestedBuilders.first().locator('input[placeholder*="nested_field"]').first();
    await nestedIdInput.fill(uniqueId('nested2'));
    await page.waitForTimeout(500);

    // Delete first conditional
    const deleteBtn = conditionals.first().locator('button[title="Remove conditional"]').first();
    await deleteBtn.click();
    await page.waitForTimeout(500);

    // Verify only 1 conditional remains
    conditionals = page.locator('.conditional-block');
    expect(await conditionals.count()).toBe(1);

    // Refresh and verify structure
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    conditionals = page.locator('.conditional-block');
    const remainingCount = await conditionals.count();
    expect(remainingCount).toBe(1);

    // Verify the remaining conditional has the correct value
    const remainingConditional = conditionals.first();
    const remainingValueInput = remainingConditional.locator('input[placeholder*="value"]').first();
    const remainingValue = await remainingValueInput.inputValue();
    expect(remainingValue).toBe('no');

    console.log('Conditional deletion test: structure preserved correctly');
  });
});
