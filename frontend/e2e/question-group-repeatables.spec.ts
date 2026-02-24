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
async function addQuestion(page: Page, text: string, identifier: string, repeatable: boolean = false, groupId?: string) {
  const addBtn = page.getByRole('button', { name: /^Add Question$/ }).last();
  await addBtn.click();
  await page.waitForTimeout(300);

  const questionBuilders = page.locator('.question-builder');
  const lastBuilder = questionBuilders.last();

  const textInput = lastBuilder.locator('textarea[placeholder*="question text"]').first();
  await textInput.fill(text);
  await page.waitForTimeout(200);

  const identifierInput = lastBuilder.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]').first();
  await identifierInput.fill(identifier);
  await page.waitForTimeout(300);

  if (repeatable) {
    // Find and check the repeatable checkbox
    const repeatableCheckbox = lastBuilder.locator('input[type="checkbox"]').first();
    await repeatableCheckbox.check();
    await page.waitForTimeout(300);

    if (groupId) {
      // Fill in the repeatable group ID
      const groupIdInput = lastBuilder.locator('input[placeholder*="group_id"]').first();
      await groupIdInput.fill(groupId);
      await page.waitForTimeout(300);
    }
  }

  await page.waitForTimeout(200);
}

test.describe('Question Group Repeatables', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(500);
  });

  test('should create a simple repeatable question', async ({ page }) => {
    const groupName = uniqueId('SimpleRepeatable');
    await createGroup(page, groupName);

    const qId = uniqueId('person');
    const groupId = uniqueId('people');

    await addQuestion(page, 'Person Name', qId, true, groupId);
    await page.waitForTimeout(500);

    // Verify repeatable checkbox is checked
    const questionBuilders = page.locator('.question-builder');
    const repeatableCheckbox = questionBuilders.first().locator('input[type="checkbox"]').first();
    expect(await repeatableCheckbox.isChecked()).toBe(true);

    // Refresh and verify repeatable state persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const repeatableCheckboxAfterRefresh = page.locator('.question-builder').first().locator('input[type="checkbox"]').first();
    expect(await repeatableCheckboxAfterRefresh.isChecked()).toBe(true);

    console.log('Simple repeatable test: repeatable state persisted correctly');
  });

  test('should create multiple questions in the same repeatable group', async ({ page }) => {
    const groupName = uniqueId('RepeatableGroup');
    await createGroup(page, groupName);

    const groupId = uniqueId('contact');

    // Add multiple questions with same group ID
    await addQuestion(page, 'Contact Name', uniqueId('name'), true, groupId);
    await addQuestion(page, 'Contact Email', uniqueId('email'), true, groupId);
    await addQuestion(page, 'Contact Phone', uniqueId('phone'), true, groupId);
    await page.waitForTimeout(500);

    // Verify all have the same group ID
    const questionBuilders = page.locator('.question-builder');
    const count = await questionBuilders.count();
    expect(count).toBe(3);

    for (let i = 0; i < count; i++) {
      const builder = questionBuilders.nth(i);
      const checkbox = builder.locator('input[type="checkbox"]').first();
      expect(await checkbox.isChecked()).toBe(true);

      const groupIdInput = builder.locator('input[placeholder*="group_id"]').first();
      const value = await groupIdInput.inputValue();
      expect(value).toBe(groupId);
    }

    // Refresh and verify
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const buildersAfterRefresh = page.locator('.question-builder');
    const countAfterRefresh = await buildersAfterRefresh.count();
    expect(countAfterRefresh).toBe(3);

    for (let i = 0; i < countAfterRefresh; i++) {
      const builder = buildersAfterRefresh.nth(i);
      const checkbox = builder.locator('input[type="checkbox"]').first();
      expect(await checkbox.isChecked()).toBe(true);

      const groupIdInput = builder.locator('input[placeholder*="group_id"]').first();
      const value = await groupIdInput.inputValue();
      expect(value).toBe(groupId);
    }

    console.log('Repeatable group test: all questions in same group persisted correctly');
  });

  test('should handle mix of repeatable and non-repeatable questions', async ({ page }) => {
    const groupName = uniqueId('MixedRepeatable');
    await createGroup(page, groupName);

    const groupId = uniqueId('address');

    // Add non-repeatable question
    await addQuestion(page, 'Full Name', uniqueId('full_name'), false);
    
    // Add repeatable questions
    await addQuestion(page, 'Street Address', uniqueId('street'), true, groupId);
    await addQuestion(page, 'City', uniqueId('city'), true, groupId);
    
    // Add another non-repeatable
    await addQuestion(page, 'Country', uniqueId('country'), false);
    
    await page.waitForTimeout(500);

    // Verify states
    const questionBuilders = page.locator('.question-builder');
    expect(await questionBuilders.count()).toBe(4);

    // First should not be repeatable
    expect(await questionBuilders.nth(0).locator('input[type="checkbox"]').first().isChecked()).toBe(false);
    
    // Second and third should be repeatable with same group ID
    expect(await questionBuilders.nth(1).locator('input[type="checkbox"]').first().isChecked()).toBe(true);
    expect(await questionBuilders.nth(2).locator('input[type="checkbox"]').first().isChecked()).toBe(true);
    
    const groupId1 = await questionBuilders.nth(1).locator('input[placeholder*="group_id"]').first().inputValue();
    const groupId2 = await questionBuilders.nth(2).locator('input[placeholder*="group_id"]').first().inputValue();
    expect(groupId1).toBe(groupId);
    expect(groupId2).toBe(groupId);
    
    // Fourth should not be repeatable
    expect(await questionBuilders.nth(3).locator('input[type="checkbox"]').first().isChecked()).toBe(false);

    // Refresh and verify
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const buildersAfterRefresh = page.locator('.question-builder');
    expect(await buildersAfterRefresh.count()).toBe(4);

    expect(await buildersAfterRefresh.nth(0).locator('input[type="checkbox"]').first().isChecked()).toBe(false);
    expect(await buildersAfterRefresh.nth(1).locator('input[type="checkbox"]').first().isChecked()).toBe(true);
    expect(await buildersAfterRefresh.nth(2).locator('input[type="checkbox"]').first().isChecked()).toBe(true);
    expect(await buildersAfterRefresh.nth(3).locator('input[type="checkbox"]').first().isChecked()).toBe(false);

    console.log('Mixed repeatable test: states persisted correctly');
  });

  test('should toggle repeatable state and persist changes', async ({ page }) => {
    const groupName = uniqueId('ToggleRepeatable');
    await createGroup(page, groupName);

    const qId = uniqueId('item');
    const groupId = uniqueId('items');

    // Add as non-repeatable
    await addQuestion(page, 'Item Name', qId, false);
    await page.waitForTimeout(500);

    let questionBuilder = page.locator('.question-builder').first();
    let checkbox = questionBuilder.locator('input[type="checkbox"]').first();
    expect(await checkbox.isChecked()).toBe(false);

    // Toggle to repeatable
    await checkbox.check();
    await page.waitForTimeout(300);

    // Fill group ID
    const groupIdInput = questionBuilder.locator('input[placeholder*="group_id"]').first();
    await groupIdInput.fill(groupId);
    await page.waitForTimeout(500);

    // Refresh and verify it's now repeatable
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    questionBuilder = page.locator('.question-builder').first();
    checkbox = questionBuilder.locator('input[type="checkbox"]').first();
    expect(await checkbox.isChecked()).toBe(true);

    const groupIdAfterRefresh = await questionBuilder.locator('input[placeholder*="group_id"]').first().inputValue();
    expect(groupIdAfterRefresh).toBe(groupId);

    // Toggle back to non-repeatable
    await checkbox.uncheck();
    await page.waitForTimeout(500);

    // Refresh and verify it's now non-repeatable
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    questionBuilder = page.locator('.question-builder').first();
    checkbox = questionBuilder.locator('input[type="checkbox"]').first();
    expect(await checkbox.isChecked()).toBe(false);

    console.log('Toggle repeatable test: state changes persisted correctly');
  });

  test('should handle repeatable questions with conditionals', async ({ page }) => {
    const groupName = uniqueId('RepeatableConditional');
    await createGroup(page, groupName);

    const groupId = uniqueId('dependents');

    // Add repeatable question
    await addQuestion(page, 'Dependent Name', uniqueId('dep_name'), true, groupId);
    await page.waitForTimeout(500);

    // Add conditional after the repeatable question
    const questionBuilders = page.locator('.question-builder').filter({ has: page.locator('textarea') });
    const insertConditionalBtn = questionBuilders.first().locator('button:has-text("Insert Conditional")').first();
    await insertConditionalBtn.click();
    await page.waitForTimeout(500);

    // Fill conditional
    const conditional = page.locator('.conditional-block').first();
    const valueInput = conditional.locator('input[placeholder*="value"]').first();
    await valueInput.fill('yes');
    await page.waitForTimeout(300);

    // Add nested question (also repeatable with same group)
    const nestedAddBtn = conditional.locator('button:has-text("Add Question")').first();
    await nestedAddBtn.click();
    await page.waitForTimeout(500);

    const nestedBuilder = conditional.locator('.question-builder').first();
    const nestedTextInput = nestedBuilder.locator('textarea[placeholder*="question text"]').first();
    await nestedTextInput.fill('Dependent Age');
    await page.waitForTimeout(200);

    const nestedIdInput = nestedBuilder.locator('input[placeholder*="nested_field"]').first();
    await nestedIdInput.fill(uniqueId('dep_age'));
    await page.waitForTimeout(300);

    // Make nested question repeatable with same group ID
    const nestedCheckbox = nestedBuilder.locator('input[type="checkbox"]').first();
    await nestedCheckbox.check();
    await page.waitForTimeout(300);

    const nestedGroupIdInput = nestedBuilder.locator('input[placeholder*="group_id"]').first();
    await nestedGroupIdInput.fill(groupId);
    await page.waitForTimeout(500);

    // Refresh and verify structure
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify conditional exists
    const conditionals = page.locator('.conditional-block');
    expect(await conditionals.count()).toBeGreaterThanOrEqual(1);

    // Verify both questions are repeatable with same group ID
    const allBuilders = page.locator('.question-builder');
    const mainBuilder = allBuilders.first();
    const mainCheckbox = mainBuilder.locator('input[type="checkbox"]').first();
    expect(await mainCheckbox.isChecked()).toBe(true);

    const mainGroupId = await mainBuilder.locator('input[placeholder*="group_id"]').first().inputValue();
    expect(mainGroupId).toBe(groupId);

    // Find nested builder inside conditional
    const nestedBuilderAfterRefresh = conditional.locator('.question-builder').first();
    const nestedCheckboxAfterRefresh = nestedBuilderAfterRefresh.locator('input[type="checkbox"]').first();
    expect(await nestedCheckboxAfterRefresh.isChecked()).toBe(true);

    const nestedGroupIdAfterRefresh = await nestedBuilderAfterRefresh.locator('input[placeholder*="group_id"]').first().inputValue();
    expect(nestedGroupIdAfterRefresh).toBe(groupId);

    console.log('Repeatable with conditionals test: structure and states persisted correctly');
  });

  test('should handle multiple repeatable groups in same question group', async ({ page }) => {
    const groupName = uniqueId('MultiRepeatableGroups');
    await createGroup(page, groupName);

    const group1 = uniqueId('phones');
    const group2 = uniqueId('emails');

    // Add first repeatable group
    await addQuestion(page, 'Phone Type', uniqueId('phone_type'), true, group1);
    await addQuestion(page, 'Phone Number', uniqueId('phone_num'), true, group1);
    
    // Add second repeatable group
    await addQuestion(page, 'Email Type', uniqueId('email_type'), true, group2);
    await addQuestion(page, 'Email Address', uniqueId('email_addr'), true, group2);
    
    await page.waitForTimeout(500);

    // Verify group IDs
    const questionBuilders = page.locator('.question-builder');
    expect(await questionBuilders.count()).toBe(4);

    const groupId0 = await questionBuilders.nth(0).locator('input[placeholder*="group_id"]').first().inputValue();
    const groupId1 = await questionBuilders.nth(1).locator('input[placeholder*="group_id"]').first().inputValue();
    const groupId2 = await questionBuilders.nth(2).locator('input[placeholder*="group_id"]').first().inputValue();
    const groupId3 = await questionBuilders.nth(3).locator('input[placeholder*="group_id"]').first().inputValue();

    expect(groupId0).toBe(group1);
    expect(groupId1).toBe(group1);
    expect(groupId2).toBe(group2);
    expect(groupId3).toBe(group2);

    // Refresh and verify
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const buildersAfterRefresh = page.locator('.question-builder');
    expect(await buildersAfterRefresh.count()).toBe(4);

    const groupId0After = await buildersAfterRefresh.nth(0).locator('input[placeholder*="group_id"]').first().inputValue();
    const groupId1After = await buildersAfterRefresh.nth(1).locator('input[placeholder*="group_id"]').first().inputValue();
    const groupId2After = await buildersAfterRefresh.nth(2).locator('input[placeholder*="group_id"]').first().inputValue();
    const groupId3After = await buildersAfterRefresh.nth(3).locator('input[placeholder*="group_id"]').first().inputValue();

    expect(groupId0After).toBe(group1);
    expect(groupId1After).toBe(group1);
    expect(groupId2After).toBe(group2);
    expect(groupId3After).toBe(group2);

    console.log('Multiple repeatable groups test: all group IDs persisted correctly');
  });
});
