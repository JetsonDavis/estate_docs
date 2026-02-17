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

async function login(page: Page) {
  await page.goto(`${TEST_CONFIG.baseUrl}/login`);
  await page.fill('input[id="username"]', TEST_CONFIG.adminEmail);
  await page.fill('input[id="password"]', TEST_CONFIG.adminPassword);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

test.describe('Nested Question Persistence', () => {
  test('nested question inside conditional should remain nested after page refresh', async ({ page }) => {
    const uniqueId = Date.now().toString();
    const groupName = `Test Group ${uniqueId}`;
    const questionIdentifier = `q1_${uniqueId}`;
    const nestedQuestionIdentifier = `nested_${uniqueId}`;

    // Step 1: Login and navigate to question groups
    await login(page);
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`);
    await page.waitForLoadState('networkidle');

    // Step 2: Click "Create Questions Group" button
    await page.click('text=Create Questions Group');
    await page.waitForTimeout(500);

    // Step 3: Fill in group name and save
    const nameInput = page.locator('input.form-input').first();
    await nameInput.fill(groupName);
    await page.waitForTimeout(500);
    
    // Click "Save Group Information" button and wait for Questions section to appear
    await page.click('text=Save Group Information');
    // Wait for the "Questions" section to appear (indicates group was saved)
    await page.waitForSelector('text=Questions', { timeout: 10000 });
    await page.waitForTimeout(1000);
    
    console.log('Group saved, Questions section visible');

    // Step 4: Add a question at the top level
    const addQuestionBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last();
    await addQuestionBtn.click();
    await page.waitForTimeout(1000);

    // Fill in the first question's identifier (placeholder: "e.g., full_name")
    const identifierInput = page.locator('input[placeholder*="full_name"]').first();
    await identifierInput.fill(questionIdentifier);
    
    // Fill question text (textarea in question-builder)
    const questionTextarea = page.locator('.question-builder textarea').first();
    await questionTextarea.fill('First question text');
    await page.waitForTimeout(2000); // Wait for auto-save

    // Step 5: Add a conditional after the first question
    // Scroll down to see the conditional button
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first();
    await conditionalBtn.click();
    await page.waitForTimeout(1500);

    // Scroll down to see the conditional and its nested content
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Step 6: The conditional was created with a nested question inside
    // But we need to click "Add Follow-on Question" to add a question inside the conditional
    // First check if there's already a nested question
    let allIdentifierInputs = page.locator('input[placeholder*="full_name"]');
    let inputCount = await allIdentifierInputs.count();
    console.log('Identifier input count after adding conditional:', inputCount);
    
    // If only 1 input, click "Add Follow-on Question" to add a nested question
    if (inputCount < 2) {
      const followOnBtn = page.locator('button').filter({ hasText: /Add Follow-on Question/ }).first();
      if (await followOnBtn.isVisible()) {
        await followOnBtn.click();
        await page.waitForTimeout(1000);
        console.log('Clicked Add Follow-on Question');
      }
    }
    
    // Scroll and recount
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    
    allIdentifierInputs = page.locator('input[placeholder*="full_name"]');
    inputCount = await allIdentifierInputs.count();
    console.log('Identifier input count after adding follow-on:', inputCount);
    
    expect(inputCount).toBeGreaterThanOrEqual(2);
    
    // Fill the nested question (the second/last one)
    await allIdentifierInputs.nth(1).fill(nestedQuestionIdentifier);
    const allTextareas = page.locator('.question-builder textarea');
    await allTextareas.nth(1).fill('Nested question text');
    await page.waitForTimeout(3000); // Wait for auto-save

    // Verify structure before refresh - count questions at different depths
    const questionBuilders = page.locator('.question-builder');
    const builderCount = await questionBuilders.count();
    console.log('Question builders before refresh:', builderCount);

    // Step 7: Refresh the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 8: Verify the nested question is still present and nested
    const identifierInputsAfter = page.locator('input[placeholder*="full_name"]');
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

    // Verify the nested question is inside the conditional (has indentation)
    // Find the question builder containing the nested identifier
    for (let i = 0; i < inputCountAfter; i++) {
      const input = identifierInputsAfter.nth(i);
      const value = await input.inputValue();
      if (value === nestedQuestionIdentifier) {
        // The nested question's parent should have margin-left > 0
        const parentBuilder = input.locator('xpath=ancestor::div[contains(@class, "question-builder")]').first();
        const style = await parentBuilder.getAttribute('style');
        console.log(`Nested question parent style:`, style);
        
        // Check for indentation - nested questions should have margin-left
        if (style && style.includes('margin-left')) {
          const marginMatch = style.match(/margin-left:\s*(\d+)/);
          if (marginMatch) {
            const marginValue = parseInt(marginMatch[1]);
            console.log(`Nested question margin-left: ${marginValue}px`);
            // Nested questions should have margin > 0
            expect(marginValue).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});
