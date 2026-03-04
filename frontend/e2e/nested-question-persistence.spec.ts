/**
 * E2E Test for Nested Question Persistence Bug
 *
 * This test verifies that nested questions inside conditionals remain nested
 * after page refresh. The bug was that nested questions would move to the
 * top level after refresh.
 */

import { test, expect, Page } from '@playwright/test';

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3005',
  adminEmail: 'admin',
  adminPassword: 'password',
};

const IDENTIFIER_INPUT_SELECTOR = 'input[placeholder="e.g., full_name"], input[placeholder="e.g., nested_field"]';

async function login(page: Page) {
  await page.goto(`${TEST_CONFIG.baseUrl}/login`);
  await page.fill('input[id="username"]', TEST_CONFIG.adminEmail);
  await page.fill('input[id="password"]', TEST_CONFIG.adminPassword);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

let createdGroupIds: number[] = []

test.describe('Nested Question Persistence', () => {
  test.afterEach(async ({ page }) => {
    for (const groupId of createdGroupIds) {
      try {
        await page.request.delete(`http://localhost:8005/api/v1/question-groups/${groupId}`)
      } catch (e) { /* ignore */ }
    }
    createdGroupIds = []
  })

  test('nested question inside conditional should remain nested after page refresh', async ({ page }) => {
    test.setTimeout(90000);
    const uniqueId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 8);
    const groupName = `E2E_NestedPersist_${uniqueId}`;
    const questionIdentifier = `q1_${uniqueId}`;
    const nestedQuestionIdentifier = `nested_${uniqueId}`;

    // Step 1: Login and navigate to question groups
    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    // Step 2: Click "Create Questions Group" button
    await page.click('text=Create Questions Group');
    await page.waitForTimeout(300);

    // Step 3: Fill in group name and save
    const nameInput = page.locator('input.form-input').first();
    await nameInput.fill(groupName);
    await page.waitForTimeout(300);
    
    // Click "Save Group Information" button and wait for Questions section to appear
    await page.click('text=Save Group Information');
    // Wait for the "Questions" section to appear (indicates group was saved)
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Extract group ID for cleanup
    const groupUrl = page.url();
    const groupMatch = groupUrl.match(/\/question-groups\/(\d+)/);
    if (groupMatch) createdGroupIds.push(parseInt(groupMatch[1], 10));

    // Some builds keep the URL on the create page; in that case open the saved group explicitly.
    if (!/\/admin\/question-groups\/\d+/.test(page.url())) {
      await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
      await page.waitForLoadState('networkidle');

      const groupLink = page
        .locator('a[href*="/admin/question-groups/"]')
        .filter({ hasText: groupName })
        .first();

      await expect(groupLink).toBeVisible({ timeout: 10000 });
      await groupLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('text=Questions', { timeout: 10000 });

      // Extract group ID if we didn't get it before
      if (createdGroupIds.length === 0) {
        const editUrl = page.url();
        const editMatch = editUrl.match(/\/question-groups\/(\d+)/);
        if (editMatch) createdGroupIds.push(parseInt(editMatch[1], 10));
      }
    }
    
    console.log('Group saved, Questions section visible');

    // Step 4: Add a question at the top level
    const addQuestionBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addQuestionBtn.click();
    await page.waitForTimeout(500);

    // Fill in the first question's identifier (placeholder: "e.g., full_name")
    const identifierInput = page.locator('input[placeholder*="full_name"]').first();
    await identifierInput.fill(questionIdentifier);
    
    // Fill question text (textarea in question-builder)
    const questionTextarea = page.locator('.question-builder textarea').first();
    await questionTextarea.fill('First question text');
    await page.waitForTimeout(1500); // Wait for auto-save

    // Step 5: Add a conditional after the first question
    // Scroll down to see the conditional button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first();
    await conditionalBtn.click();
    await page.waitForTimeout(1000);

    // Scroll down to see the conditional and its nested content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Step 6: The conditional was created with a nested question inside
    // But we need to click "Add Follow-on Question" to add a question inside the conditional
    // First check if there's already a nested question
    let allIdentifierInputs = page.locator(IDENTIFIER_INPUT_SELECTOR);
    let inputCount = await allIdentifierInputs.count();
    console.log('Identifier input count after adding conditional:', inputCount);
    
    // If only 1 input, click "Add Question Inside Conditional" to add a nested question
    if (inputCount < 2) {
      // Try "Add Question Inside Conditional" first (for root-level conditionals)
      let addNestedBtn = page.locator('button').filter({ hasText: /Add Question Inside Conditional/ }).first();
      if (await addNestedBtn.isVisible()) {
        await addNestedBtn.click();
        await page.waitForTimeout(1000);
        console.log('Clicked Add Question Inside Conditional');
      } else {
        // Fallback to "Add Follow-on Question" (for nested conditionals)
        addNestedBtn = page.locator('button').filter({ hasText: /Add Follow-on Question/ }).first();
        if (await addNestedBtn.isVisible()) {
          await addNestedBtn.click();
          await page.waitForTimeout(1000);
          console.log('Clicked Add Follow-on Question');
        }
      }
    }
    
    // Scroll and recount
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    allIdentifierInputs = page.locator(IDENTIFIER_INPUT_SELECTOR);
    inputCount = await allIdentifierInputs.count();
    console.log('Identifier input count after adding follow-on:', inputCount);
    
    expect(inputCount).toBeGreaterThanOrEqual(2);
    
    // Fill an actual nested question identifier (prefer the first empty one)
    let nestedInputIndex = inputCount - 1;
    for (let i = 0; i < inputCount; i++) {
      const value = await allIdentifierInputs.nth(i).inputValue();
      if (!value) {
        nestedInputIndex = i;
        break;
      }
    }

    const nestedIdInput = allIdentifierInputs.nth(nestedInputIndex);
    await nestedIdInput.scrollIntoViewIfNeeded();
    await nestedIdInput.fill(nestedQuestionIdentifier);
    // Find the textarea that follows this identifier input's form group
    // The nested question textarea is a sibling section within the same parent container
    const nestedTextarea = page.locator('textarea[placeholder="Enter your question here..."]').nth(nestedInputIndex);
    await nestedTextarea.scrollIntoViewIfNeeded();
    await nestedTextarea.fill('Nested question text');
    await page.waitForTimeout(2000); // Wait for auto-save

    // Verify structure before refresh - count questions at different depths
    const questionBuilders = page.locator('.question-builder');
    const builderCount = await questionBuilders.count();
    console.log('Question builders before refresh:', builderCount);

    // Step 7: Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 8: Verify the nested question is still present and nested
    const identifierInputsAfter = page.locator(IDENTIFIER_INPUT_SELECTOR);
    const inputCountAfter = await identifierInputsAfter.count();
    console.log('Identifier input count after refresh:', inputCountAfter);

    // Get all identifier values
    const identifierValues: string[] = [];
    for (let i = 0; i < inputCountAfter; i++) {
      const value = await identifierInputsAfter.nth(i).inputValue();
      identifierValues.push(value);
    }
    console.log('Identifier values after refresh:', identifierValues);

    // CRITICAL ASSERTION: Both questions should still exist
    expect(identifierValues).toContain(questionIdentifier);
    expect(identifierValues).toContain(nestedQuestionIdentifier);

    // Verify we still have a conditional block
    const conditionalBlocks = page.locator('[class*="conditional"]');
    const conditionalCount = await conditionalBlocks.count();
    console.log('Conditional blocks after refresh:', conditionalCount);
    expect(conditionalCount).toBeGreaterThan(0);

    // Verify the nested question is inside the conditional (is a descendant of .conditional-block)
    for (let i = 0; i < inputCountAfter; i++) {
      const input = identifierInputsAfter.nth(i);
      const value = await input.inputValue();
      if (value === nestedQuestionIdentifier) {
        // The nested question should be inside a .conditional-block element
        const isInsideConditional = await input.evaluate((el) => {
          return el.closest('.conditional-block') !== null;
        });
        console.log(`Nested question is inside conditional: ${isInsideConditional}`);
        expect(isInsideConditional).toBe(true);
      }
    }
  });
});
