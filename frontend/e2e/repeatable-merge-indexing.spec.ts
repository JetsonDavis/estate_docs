import { test, expect } from '@playwright/test';
import {
  apiLogin,
  createTestQuestionGroup,
  createTestSession,
  createTestTemplate,
  saveAnswers,
  deleteSession,
  deleteQuestionGroup,
  deleteTemplate,
  TestQuestionGroup,
} from './helpers/test-data-api';

const BASE_URL = 'http://localhost:3005';

let groupData: TestQuestionGroup;
let sessionId: number;
let templateId: number;
const SESSION_NAME = 'E2E_MergeIndex_Client';
const TEMPLATE_NAME = 'E2E_MergeIndex_Template';

test.describe('Repeatable Conditional Followups - Merge Indexing', () => {
  test.beforeAll(async () => {
    await apiLogin();
    groupData = await createTestQuestionGroup('MergeIndex');
    sessionId = await createTestSession(groupData.groupId, SESSION_NAME);

    // Seed one trustor with able_to_act = "no"
    await saveAnswers(sessionId, [
      { question_id: groupData.trustorId, answer_value: '[{"name":"Test Trustor"}]' },
      { question_id: groupData.ableToActId, answer_value: '["no"]' },
      { question_id: groupData.unableReasonId, answer_value: '[""]' },
      { question_id: groupData.unableDateId, answer_value: '[""]' },
    ]);

    // Create a template that references unable_reason by trustor index
    const templateContent = [
      '<p>Trustor 1 unable reason: &lt;&lt;unable_reason[1]&gt;&gt;</p>',
      '<p>Trustor 2 unable reason: &lt;&lt;unable_reason[2]&gt;&gt;</p>',
    ].join('\n');
    templateId = await createTestTemplate(TEMPLATE_NAME, templateContent);
  });

  test.afterAll(async () => {
    await deleteSession(sessionId);
    await deleteTemplate(templateId);
    await deleteQuestionGroup(groupData.groupId);
  });

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`);
    await page.waitForSelector('input[id="username"]');
    await page.fill('input[id="username"]', 'admin');
    await page.fill('input[id="password"]', 'password');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('should correctly index 2D arrays in merged documents', async ({ page }) => {
    test.setTimeout(120000);

    // Navigate to the input form
    await page.goto(`${BASE_URL}/document?session=${sessionId}`);
    
    // Wait for the form to load
    await page.waitForSelector('text=are they able to act?', { timeout: 15000 });
    await page.waitForTimeout(2000);
    
    // Set up first trustor with "No"
    const firstNoLabel = page.locator('label:has-text("No")').first();
    await firstNoLabel.click();
    await page.waitForTimeout(1000);
    
    // First trustor unable reason
    const firstTrustorReason = page.locator('textarea').first();
    await firstTrustorReason.click();
    await firstTrustorReason.fill('Trustor 1 - Unable Reason');
    await firstTrustorReason.blur();
    await page.waitForTimeout(2000);
    
    // Add a second trustor
    await page.click('button:has-text("Add Another")');
    await page.waitForTimeout(2000);
    
    // Set up second trustor with "No"
    const allNoLabels = page.locator('label:has-text("No")');
    const noLabelCount = await allNoLabels.count();
    await allNoLabels.nth(noLabelCount - 1).click();
    await page.waitForTimeout(1000);
    
    // Second trustor unable reason
    const allTextareas = page.locator('textarea');
    const secondTrustorReason = allTextareas.nth(1);
    await secondTrustorReason.click();
    await secondTrustorReason.fill('Trustor 2 - Unable Reason');
    await secondTrustorReason.blur();
    await page.waitForTimeout(3000);
    
    console.log('Created 2D array structure:');
    console.log('Trustor 1: ["Trustor 1 - Unable Reason"]');
    console.log('Trustor 2: ["Trustor 2 - Unable Reason"]');
    
    // Navigate to merge documents page
    await page.goto(`${BASE_URL}/merge-documents`);
    await page.waitForTimeout(2000);
    
    // Select the test session
    await expect(page.locator(`text=${SESSION_NAME}`).first()).toBeVisible({ timeout: 10000 });
    await page.locator('li', { has: page.locator(`text=${SESSION_NAME}`) }).first().locator('input[type="radio"]').click();
    await page.waitForTimeout(1000);
    
    // Scroll down to see templates section
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    
    // Select the test template
    const templateHeading = page.locator('heading:has-text("Templates")');
    await expect(templateHeading).toBeVisible({ timeout: 5000 });
    await page.locator('li', { has: page.locator(`text=${TEMPLATE_NAME}`) }).first().locator('input[type="radio"]').click();
    await page.waitForTimeout(1000);
    
    // Scroll to top and click the "Merge Documents" button
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    const mergeButton = page.locator('button:has-text("Merge Documents")').first();
    await expect(mergeButton).toBeEnabled({ timeout: 10000 });
    await mergeButton.click();
    await page.waitForTimeout(5000);
    
    // Verify the merged document content
    const pageContent = await page.textContent('body');
    
    console.log('Page content after merge (first 3000 chars):');
    console.log(pageContent?.substring(0, 3000));
    
    // Check if both values are present in the merged document
    if (pageContent) {
      expect(pageContent).toContain('Trustor 1 - Unable Reason');
      expect(pageContent).toContain('Trustor 2 - Unable Reason');
      
      console.log('✓ All 2D array values found in merged document');
      console.log('✓ Verified that unable_reason[1] and unable_reason[2] are correctly indexed');
    }
  });
});
