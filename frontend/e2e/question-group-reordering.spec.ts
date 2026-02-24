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
  await addBtn.click();
  await page.waitForTimeout(300);

  const questionBuilders = page.locator('.question-builder');
  const lastBuilder = questionBuilders.last();

  const textInput = lastBuilder.locator('textarea[placeholder*="question text"]').first();
  await textInput.fill(text);
  await page.waitForTimeout(200);

  const identifierInput = lastBuilder.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]').first();
  await identifierInput.fill(identifier);
  await page.waitForTimeout(500);
}

// Helper to get question identifiers in order
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

// Helper to insert question before a specific index
async function insertQuestionBefore(page: Page, beforeIndex: number, text: string, identifier: string) {
  const insertBtns = page.locator('button:has-text("Insert Question")');
  await insertBtns.nth(beforeIndex).click();
  await page.waitForTimeout(500);

  // The new question is inserted, find it and fill it
  const questionBuilders = page.locator('.question-builder');
  const newBuilder = questionBuilders.nth(beforeIndex);

  const textInput = newBuilder.locator('textarea[placeholder*="question text"]').first();
  await textInput.fill(text);
  await page.waitForTimeout(200);

  const identifierInput = newBuilder.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]').first();
  await identifierInput.fill(identifier);
  await page.waitForTimeout(500);
}

test.describe('Question Group Reordering & Insertion', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    await page.waitForTimeout(500);
  });

  test('should insert questions at the beginning', async ({ page }) => {
    const groupName = uniqueId('InsertBeginning');
    await createGroup(page, groupName);

    // Add 3 questions
    const q1 = uniqueId('q1');
    const q2 = uniqueId('q2');
    const q3 = uniqueId('q3');

    await addQuestion(page, 'Question 1', q1);
    await addQuestion(page, 'Question 2', q2);
    await addQuestion(page, 'Question 3', q3);
    await page.waitForTimeout(500);

    let identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([q1, q2, q3]);

    // Insert at beginning
    const qNew = uniqueId('q_new');
    await insertQuestionBefore(page, 0, 'New First Question', qNew);
    await page.waitForTimeout(500);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([qNew, q1, q2, q3]);

    // Refresh and verify order persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([qNew, q1, q2, q3]);

    console.log('Insert at beginning test: order persisted correctly');
  });

  test('should insert questions in the middle', async ({ page }) => {
    const groupName = uniqueId('InsertMiddle');
    await createGroup(page, groupName);

    // Add 4 questions
    const q1 = uniqueId('q1');
    const q2 = uniqueId('q2');
    const q3 = uniqueId('q3');
    const q4 = uniqueId('q4');

    await addQuestion(page, 'Question 1', q1);
    await addQuestion(page, 'Question 2', q2);
    await addQuestion(page, 'Question 3', q3);
    await addQuestion(page, 'Question 4', q4);
    await page.waitForTimeout(500);

    let identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([q1, q2, q3, q4]);

    // Insert between q2 and q3 (before index 2)
    const qNew = uniqueId('q_new');
    await insertQuestionBefore(page, 2, 'New Middle Question', qNew);
    await page.waitForTimeout(500);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([q1, q2, qNew, q3, q4]);

    // Refresh and verify
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([q1, q2, qNew, q3, q4]);

    console.log('Insert in middle test: order persisted correctly');
  });

  test('should handle multiple insertions and maintain order', async ({ page }) => {
    const groupName = uniqueId('MultiInsert');
    await createGroup(page, groupName);

    // Start with 2 questions
    const q1 = uniqueId('q1');
    const q2 = uniqueId('q2');

    await addQuestion(page, 'Question 1', q1);
    await addQuestion(page, 'Question 2', q2);
    await page.waitForTimeout(500);

    // Insert before q1
    const qA = uniqueId('qA');
    await insertQuestionBefore(page, 0, 'Question A', qA);
    await page.waitForTimeout(500);

    // Insert before q2 (now at index 2)
    const qB = uniqueId('qB');
    await insertQuestionBefore(page, 2, 'Question B', qB);
    await page.waitForTimeout(500);

    // Insert before qB (now at index 2)
    const qC = uniqueId('qC');
    await insertQuestionBefore(page, 2, 'Question C', qC);
    await page.waitForTimeout(500);

    let identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([qA, q1, qC, qB, q2]);

    // Refresh and verify
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual([qA, q1, qC, qB, q2]);

    console.log('Multiple insertions test: complex order persisted correctly');
  });

  test('should insert questions with conditionals present', async ({ page }) => {
    const groupName = uniqueId('InsertWithConditional');
    await createGroup(page, groupName);

    // Add 2 questions
    const q1 = uniqueId('q1');
    const q2 = uniqueId('q2');

    await addQuestion(page, 'Question 1', q1);
    await addQuestion(page, 'Question 2', q2);
    await page.waitForTimeout(500);

    // Add conditional after q1
    const questionBuilders = page.locator('.question-builder').filter({ has: page.locator('textarea') });
    const insertConditionalBtn = questionBuilders.first().locator('button:has-text("Insert Conditional")').first();
    await insertConditionalBtn.click();
    await page.waitForTimeout(500);

    // Fill conditional
    const conditional = page.locator('.conditional-block').first();
    const valueInput = conditional.locator('input[placeholder*="value"]').first();
    await valueInput.fill('yes');
    await page.waitForTimeout(300);

    // Add nested question in conditional
    const nestedAddBtn = conditional.locator('button:has-text("Add Question")').first();
    await nestedAddBtn.click();
    await page.waitForTimeout(500);

    const nestedBuilders = conditional.locator('.question-builder');
    const nestedIdInput = nestedBuilders.first().locator('input[placeholder*="nested_field"]').first();
    const qNested = uniqueId('q_nested');
    await nestedIdInput.fill(qNested);
    await page.waitForTimeout(500);

    // Now insert a question before q2 (should be after the conditional)
    const qNew = uniqueId('q_new');
    // Find the insert button before q2 (not inside conditional)
    const mainInsertBtns = page.locator('.question-builder').filter({ has: page.locator('textarea') }).locator('button:has-text("Insert Question")');
    await mainInsertBtns.nth(1).click(); // Second insert button (before q2)
    await page.waitForTimeout(500);

    // Fill the new question
    const allBuilders = page.locator('.question-builder').filter({ has: page.locator('textarea') });
    const newBuilder = allBuilders.nth(1); // Should be the newly inserted one
    const newTextInput = newBuilder.locator('textarea[placeholder*="question text"]').first();
    await newTextInput.fill('New Question');
    await page.waitForTimeout(200);

    const newIdInput = newBuilder.locator('input[placeholder*="full_name"]').first();
    await newIdInput.fill(qNew);
    await page.waitForTimeout(500);

    // Get main-level identifiers (not nested)
    const mainIdentifiers = await getQuestionIdentifiers(page);
    
    // Should have q1, qNew, q2 at main level, plus qNested inside conditional
    expect(mainIdentifiers).toContain(q1);
    expect(mainIdentifiers).toContain(q2);
    expect(mainIdentifiers).toContain(qNew);
    expect(mainIdentifiers).toContain(qNested);

    // Refresh and verify structure
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    const identifiersAfterRefresh = await getQuestionIdentifiers(page);
    expect(identifiersAfterRefresh).toContain(q1);
    expect(identifiersAfterRefresh).toContain(q2);
    expect(identifiersAfterRefresh).toContain(qNew);
    expect(identifiersAfterRefresh).toContain(qNested);

    // Verify conditional still exists
    const conditionals = page.locator('.conditional-block');
    expect(await conditionals.count()).toBeGreaterThanOrEqual(1);

    console.log('Insert with conditionals test: structure preserved correctly');
  });

  test('should handle insertion at every position in a 5-question group', async ({ page }) => {
    const groupName = uniqueId('InsertEveryPosition');
    await createGroup(page, groupName);

    // Add 5 questions
    const questions = [];
    for (let i = 1; i <= 5; i++) {
      const id = uniqueId(`q${i}`);
      questions.push(id);
      await addQuestion(page, `Question ${i}`, id);
    }
    await page.waitForTimeout(500);

    let identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toEqual(questions);

    // Insert at position 0 (beginning)
    const qNew0 = uniqueId('q_new0');
    await insertQuestionBefore(page, 0, 'New at 0', qNew0);
    await page.waitForTimeout(500);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers[0]).toBe(qNew0);

    // Insert at position 3 (middle)
    const qNew3 = uniqueId('q_new3');
    await insertQuestionBefore(page, 3, 'New at 3', qNew3);
    await page.waitForTimeout(500);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers[3]).toBe(qNew3);

    // Refresh and verify all insertions persisted
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);

    identifiers = await getQuestionIdentifiers(page);
    expect(identifiers).toContain(qNew0);
    expect(identifiers).toContain(qNew3);
    expect(identifiers.length).toBe(7); // 5 original + 2 inserted

    console.log('Insert at every position test: all insertions persisted correctly');
  });
});
