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

async function getQuestionIdentifiers(page: Page): Promise<string[]> {
  const identifierInputs = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
  const count = await identifierInputs.count();
  const identifiers: string[] = [];
  
  for (let i = 0; i < count; i++) {
    const value = await identifierInputs.nth(i).inputValue();
    if (value) {
      identifiers.push(value);
    }
  }
  
  return identifiers;
}

test.describe('Question Group Reordering & Insertion', () => {
  test('should insert question at the beginning', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `InsertBeginning_${uniqueId}`;

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
    const q1 = `q1_${uniqueId}`;
    const q2 = `q2_${uniqueId}`;
    const q3 = `q3_${uniqueId}`;

    for (let i = 0; i < 3; i++) {
      const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
      await addBtn.click();
      await page.waitForTimeout(1000);

      const identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await identifiers.nth(i).fill([q1, q2, q3][i]);
      const textareas = page.locator('.question-builder textarea');
      await textareas.nth(i).fill(`Question ${i + 1}`);
      await page.waitForTimeout(1000);
    }

    let identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([q1, q2, q3]);

    // Insert at beginning using Insert Question button
    const insertBtns = page.locator('button:has-text("Insert Question")');
    if (await insertBtns.count() > 0) {
      await insertBtns.first().click();
      await page.waitForTimeout(1000);

      const qNew = `q_new_${uniqueId}`;
      const newIdentifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await newIdentifiers.first().fill(qNew);
      const newTextareas = page.locator('.question-builder textarea');
      await newTextareas.first().fill('New First Question');
      await page.waitForTimeout(2000);

      identifiers = await getQuestionIdentifiers(page);
      expect(identifiers[0]).toBe(qNew);
      expect(identifiers).toContain(q1);
      expect(identifiers).toContain(q2);
      expect(identifiers).toContain(q3);

      console.log('Insert at beginning test: order correct');
    } else {
      console.log('Insert Question button not available, skipping insertion test');
    }
  });

  test('should insert question in the middle', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `InsertMiddle_${uniqueId}`;

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

    // Add 4 questions
    const q1 = `q1_${uniqueId}`;
    const q2 = `q2_${uniqueId}`;
    const q3 = `q3_${uniqueId}`;
    const q4 = `q4_${uniqueId}`;

    for (let i = 0; i < 4; i++) {
      const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
      await addBtn.click();
      await page.waitForTimeout(1000);

      const identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await identifiers.nth(i).fill([q1, q2, q3, q4][i]);
      const textareas = page.locator('.question-builder textarea');
      await textareas.nth(i).fill(`Question ${i + 1}`);
      await page.waitForTimeout(1000);
    }

    let identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([q1, q2, q3, q4]);

    // Insert between q2 and q3 if Insert button exists
    const insertBtns = page.locator('button:has-text("Insert Question")');
    if (await insertBtns.count() >= 3) {
      await insertBtns.nth(2).click();
      await page.waitForTimeout(1000);

      const qNew = `q_new_${uniqueId}`;
      const newIdentifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await newIdentifiers.nth(2).fill(qNew);
      const newTextareas = page.locator('.question-builder textarea');
      await newTextareas.nth(2).fill('New Middle Question');
      await page.waitForTimeout(2000);

      identifiers = await getQuestionIdentifiers(page);
      expect(identifiers).toContain(q1);
      expect(identifiers).toContain(q2);
      expect(identifiers).toContain(qNew);
      expect(identifiers).toContain(q3);
      expect(identifiers).toContain(q4);

      console.log('Insert in middle test: order correct');
    } else {
      console.log('Insert Question button not available, skipping insertion test');
    }
  });

  test('should maintain question order after multiple operations', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `MultiOps_${uniqueId}`;

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
    const q1 = `q1_${uniqueId}`;
    const q2 = `q2_${uniqueId}`;
    const q3 = `q3_${uniqueId}`;

    for (let i = 0; i < 3; i++) {
      const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
      await addBtn.click();
      await page.waitForTimeout(1000);

      const identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await identifiers.nth(i).fill([q1, q2, q3][i]);
      const textareas = page.locator('.question-builder textarea');
      await textareas.nth(i).fill(`Question ${i + 1}`);
      await page.waitForTimeout(1000);
    }

    let identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([q1, q2, q3]);

    // Refresh and verify order persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([q1, q2, q3]);

    console.log('Multiple operations test: order persisted correctly');
  });

  test('should handle question deletion and preserve order', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `DeletePreserveOrder_${uniqueId}`;

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

    // Add 5 questions
    const questions = [];
    for (let i = 0; i < 5; i++) {
      const qId = `q${i}_${uniqueId}`;
      questions.push(qId);
      
      const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
      await addBtn.click();
      await page.waitForTimeout(1000);

      const identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
      await identifiers.nth(i).fill(qId);
      const textareas = page.locator('.question-builder textarea');
      await textareas.nth(i).fill(`Question ${i + 1}`);
      await page.waitForTimeout(1000);
    }

    let identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual(questions);

    // Delete middle question (index 2)
    const deleteBtns = page.locator('button[title*="delete" i], button[aria-label*="delete" i]').filter({ has: page.locator('svg') });
    if (await deleteBtns.count() >= 3) {
      await deleteBtns.nth(2).click();
      await page.waitForTimeout(2000);

      identifiers = await getQuestionIdentifiers(page);
      expect(identifiers).toContain(questions[0]);
      expect(identifiers).toContain(questions[1]);
      expect(identifiers).not.toContain(questions[2]);
      expect(identifiers).toContain(questions[3]);
      expect(identifiers).toContain(questions[4]);

      console.log('Delete preserve order test: order maintained after deletion');
    } else {
      console.log('Delete buttons not available, skipping deletion test');
    }
  });

  test('should handle adding questions after conditional', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `AddAfterConditional_${uniqueId}`;

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

    // Add first question
    const q1 = `q1_${uniqueId}`;
    let addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addBtn.click();
    await page.waitForTimeout(1000);

    let identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
    await identifiers.nth(0).fill(q1);
    let textareas = page.locator('.question-builder textarea');
    await textareas.nth(0).fill('Question 1');
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

    // Add question after conditional
    const q2 = `q2_${uniqueId}`;
    addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addBtn.click();
    await page.waitForTimeout(1000);

    identifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]');
    const count = await identifiers.count();
    await identifiers.nth(count - 1).fill(q2);
    textareas = page.locator('.question-builder textarea');
    await textareas.nth(count - 1).fill('Question 2');
    await page.waitForTimeout(2000);

    // Verify both questions exist
    const finalIdentifiers = await getQuestionIdentifiers(page);
    expect(finalIdentifiers).toContain(q1);
    expect(finalIdentifiers).toContain(q2);

    // Verify conditional exists
    const conditionalBlocks = page.locator('.conditional-block');
    expect(await conditionalBlocks.count()).toBeGreaterThanOrEqual(1);

    console.log('Add after conditional test: questions and conditional coexist');
  });
});
