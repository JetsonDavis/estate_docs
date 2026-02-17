/**
 * E2E Tests for Question Group Deletion Scenarios
 */

import { test, expect, Page } from '@playwright/test';

// Run tests in this file serially - they share database state
test.describe.configure({ mode: 'serial' });

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3005',
  adminEmail: 'admin',
  adminPassword: 'password',
};

function uniqueGroupName(prefix: string): string {
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${randomSuffix}`;
}

// Helper to create a group and wait for it to be ready
async function createGroup(page: Page, groupName: string) {
  await page.goto('/admin/question-groups');
  await page.click('text=Create Questions Group');
  await page.waitForTimeout(500);
  
  await page.fill('input.form-input', groupName);
  await page.waitForTimeout(3000); // Wait for name check
  
  await page.click('text=Save Group Information');
  await page.waitForSelector('text=Questions', { timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.waitForSelector('button:has-text("Add Question"):not([disabled])', { timeout: 30000 });
}

// Helper to add a question
async function addQuestion(page: Page, identifier: string) {
  await page.click('button:has-text("Add Question")');
  await page.waitForTimeout(500);
  const inputs = page.locator('input[placeholder*="full_name"]');
  const count = await inputs.count();
  await inputs.nth(count - 1).fill(identifier);
  await page.waitForTimeout(2000); // Wait for auto-save
}

// Helper to delete question by index
async function deleteQuestion(page: Page, index: number) {
  const deleteButtons = page.locator('button.remove-button, button[title="Remove question"]');
  await deleteButtons.nth(index).click();
  await page.waitForTimeout(2000);
}

// Helper to get question count
async function getQuestionCount(page: Page): Promise<number> {
  return await page.locator('input[placeholder*="full_name"]').count();
}

// Helper to get question identifiers
async function getIdentifiers(page: Page): Promise<string[]> {
  const inputs = page.locator('input[placeholder*="full_name"]');
  const count = await inputs.count();
  const identifiers: string[] = [];
  for (let i = 0; i < count; i++) {
    identifiers.push(await inputs.nth(i).inputValue());
  }
  return identifiers;
}

test.describe('Question Group Deletion Tests', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[id="username"]', TEST_CONFIG.adminEmail);
    await page.fill('input[id="password"]', TEST_CONFIG.adminPassword);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
  });

  test('Test 1: Create 3 questions, delete 2nd, verify 2 remain', async ({ page }) => {
    await createGroup(page, uniqueGroupName('DelTest1'));

    await addQuestion(page, 'q1');
    await addQuestion(page, 'q2');
    await addQuestion(page, 'q3');

    expect(await getQuestionCount(page)).toBe(3);

    await deleteQuestion(page, 1);

    expect(await getQuestionCount(page)).toBe(2);

    const identifiers = await getIdentifiers(page);
    expect(identifiers).toContain('q1');
    expect(identifiers).toContain('q3');
    expect(identifiers).not.toContain('q2');
  });

  test('Test 2: Delete first question', async ({ page }) => {
    await createGroup(page, uniqueGroupName('DelTest2'));

    await addQuestion(page, 'q1');
    await addQuestion(page, 'q2');
    await addQuestion(page, 'q3');

    await deleteQuestion(page, 0);

    expect(await getQuestionCount(page)).toBe(2);

    const identifiers = await getIdentifiers(page);
    expect(identifiers[0]).toBe('q2');
    expect(identifiers[1]).toBe('q3');
  });

  test('Test 3: Delete last question', async ({ page }) => {
    await createGroup(page, uniqueGroupName('DelTest3'));

    await addQuestion(page, 'q1');
    await addQuestion(page, 'q2');
    await addQuestion(page, 'q3');

    await deleteQuestion(page, 2);

    expect(await getQuestionCount(page)).toBe(2);

    const identifiers = await getIdentifiers(page);
    expect(identifiers[0]).toBe('q1');
    expect(identifiers[1]).toBe('q2');
  });

  test('Test 4: Delete all questions one by one', async ({ page }) => {
    await createGroup(page, uniqueGroupName('DelTest4'));

    await addQuestion(page, 'q1');
    await addQuestion(page, 'q2');
    await addQuestion(page, 'q3');

    for (let remaining = 3; remaining > 0; remaining--) {
      await deleteQuestion(page, 0);
      expect(await getQuestionCount(page)).toBe(remaining - 1);
    }
  });

  test('Test 5: Delete multiple questions preserves order', async ({ page }) => {
    await createGroup(page, uniqueGroupName('DelTest5'));

    await addQuestion(page, 'q1');
    await addQuestion(page, 'q2');
    await addQuestion(page, 'q3');
    await addQuestion(page, 'q4');
    await addQuestion(page, 'q5');

    await deleteQuestion(page, 1); // Delete q2
    await deleteQuestion(page, 2); // Delete q4 (now at index 2)

    const identifiers = await getIdentifiers(page);
    expect(identifiers.length).toBe(3);
    expect(identifiers[0]).toBe('q1');
    expect(identifiers[1]).toBe('q3');
    expect(identifiers[2]).toBe('q5');
  });

  test('Test 6: Create single question and delete it', async ({ page }) => {
    await createGroup(page, uniqueGroupName('DelTest6'));

    await addQuestion(page, 'single_q');
    expect(await getQuestionCount(page)).toBe(1);

    await deleteQuestion(page, 0);
    expect(await getQuestionCount(page)).toBe(0);
  });

  test('Test 7: Add and delete conditional', async ({ page }) => {
    await createGroup(page, uniqueGroupName('DelTest7'));

    await addQuestion(page, 'root_q');

    // Add a conditional
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first();
    await conditionalBtn.click();
    await page.waitForTimeout(2000);

    // Verify conditional was added (should see "Remove conditional" button)
    const conditionalDeleteBtn = page.locator('button[title="Remove conditional"]').first();
    expect(await conditionalDeleteBtn.isVisible()).toBe(true);

    // Delete the conditional
    await conditionalDeleteBtn.click();
    await page.waitForTimeout(2000);

    // Conditional should be removed
    expect(await page.locator('button[title="Remove conditional"]').count()).toBe(0);
    
    // Root question should still exist
    expect((await getIdentifiers(page))).toContain('root_q');
  });

  test('Test 8: Delete second of two questions', async ({ page }) => {
    await createGroup(page, uniqueGroupName('DelTest8'));

    await addQuestion(page, 'q1');
    await addQuestion(page, 'q2');

    expect(await getQuestionCount(page)).toBe(2);

    await deleteQuestion(page, 1);

    expect(await getQuestionCount(page)).toBe(1);
    expect((await getIdentifiers(page))[0]).toBe('q1');
  });
});
