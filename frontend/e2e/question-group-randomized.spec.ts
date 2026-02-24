/**
 * E2E Tests for Question Group UI with Randomized User Interactions
 * 
 * These tests simulate real user behavior by performing random sequences of actions
 * on the Question Group admin page, testing for stability and correctness.
 * 
 * REPRODUCIBILITY: Tests use seeded random for reproducibility.
 * - Set TEST_SEED env var to reproduce a specific test run
 * - The seed is logged at the start of each test
 * - Example: TEST_SEED=1234567890 npm run test:e2e
 */

import { test, expect, Page } from '@playwright/test';
import seedrandom from 'seedrandom';

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:3005',
  backendUrl: 'http://localhost:8005',
  adminEmail: 'admin',
  adminPassword: 'password',
  minActions: 10,
  maxActions: 20,
};

// Seeded random number generator for reproducibility
// Use TEST_SEED env var to reproduce a specific test run
const TEST_SEED = process.env.TEST_SEED || Date.now().toString();
let rng: seedrandom.PRNG;

function initRng(testName: string) {
  const seed = `${TEST_SEED}-${testName}`;
  rng = seedrandom(seed);
  console.log(`\n========================================`);
  console.log(`TEST SEED: ${TEST_SEED}`);
  console.log(`Full seed for "${testName}": ${seed}`);
  console.log(`To reproduce: TEST_SEED=${TEST_SEED} npm run test:e2e`);
  console.log(`========================================\n`);
  return seed;
}

// Action types that can be performed
type ActionType = 
  | 'addQuestion'
  | 'deleteQuestion'
  | 'insertQuestionInMiddle'
  | 'addConditional'
  | 'deleteConditional'
  | 'reorderQuestion'
  | 'editQuestionText'
  | 'changeQuestionType'
  | 'toggleRepeatable';

// Helper to generate random number in range (seeded)
function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// Helper to pick random item from array (seeded)
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Helper to generate random string (seeded)
function randomString(length: number = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from({ length }, () => chars[Math.floor(rng() * chars.length)]).join('');
}

// Test state tracker
interface TestState {
  questionCount: number;
  conditionalCount: number;
  actions: string[];
}

class QuestionGroupPage {
  constructor(private page: Page) {}

  async login() {
    // Login via API (bypasses UI login)
    const response = await this.page.request.post(`${TEST_CONFIG.backendUrl}/api/v1/auth/login`, {
      data: {
        username: TEST_CONFIG.adminEmail,
        password: TEST_CONFIG.adminPassword,
      },
    });
    
    // Set cookies for the frontend domain
    const cookies = response.headers()['set-cookie'];
    if (cookies) {
      const cookieStrings = Array.isArray(cookies) ? cookies : [cookies];
      for (const cookieStr of cookieStrings) {
        const [nameValue] = cookieStr.split(';');
        const [name, value] = nameValue.split('=');
        await this.page.context().addCookies([{
          name: name.trim(),
          value: value.trim(),
          domain: 'localhost',
          path: '/',
        }]);
      }
    }
  }

  async navigateToQuestionGroups() {
    await this.page.goto('/admin/question-groups');
    await this.page.waitForLoadState('networkidle');
  }

  async createNewGroup(name: string) {
    // Open create form if we are still on the list page.
    const createBtn = this.page.getByRole('button', { name: /Create Question(s)? Group/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      await this.page.waitForLoadState('networkidle');
    }

    // Fill in and save group info before interacting with questions.
    const nameInput = this.page.locator('label:has-text("Name") + input, label:has-text("Name") ~ input, input.form-input').first();
    await nameInput.fill(name);

    const checkingName = this.page.getByText('Checking name...');
    if (await checkingName.isVisible().catch(() => false)) {
      await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
    }

    const saveGroupInfoBtn = this.page.getByRole('button', { name: /Save Group Information/i }).first();
    await expect(saveGroupInfoBtn).toBeVisible({ timeout: 10000 });
    await saveGroupInfoBtn.click();

    await this.page.waitForSelector('text=Questions', { timeout: 30000 });
    await expect(this.page.getByRole('button', { name: /^Add Question$/ }).last()).toBeVisible({ timeout: 30000 });
    await this.page.waitForTimeout(500);
  }

  async selectExistingGroup() {
    // Click on the first question group in the list
    const groupLink = this.page.locator('a[href*="/admin/question-groups/"]').first();
    if (await groupLink.isVisible()) {
      await groupLink.click();
      await this.page.waitForLoadState('networkidle');
      return true;
    }
    return false;
  }

  async getQuestionCount(): Promise<number> {
    // Count question cards/items on the page
    const questions = this.page.locator('[data-testid="question-item"], .question-card, [class*="question"]').filter({
      hasText: /Question:/
    });
    return await questions.count();
  }

  async clickAddQuestion() {
    // Find and click the "Add Question" button at the bottom
    const addBtn = this.page.getByRole('button', { name: /^Add Question$/ }).last();
    if (await addBtn.isVisible().catch(() => false)) {
      await addBtn.click();
      await this.page.waitForTimeout(300);
      return true;
    }
    return false;
  }

  async clickInsertQuestion(index: number) {
    // Find insert buttons between questions
    const insertBtns = this.page.getByRole('button', { name: /Insert Question/i });
    const count = await insertBtns.count();
    if (count > 0 && index < count) {
      await insertBtns.nth(index).click();
      await this.page.waitForTimeout(300);
      return true;
    }
    return false;
  }

  async deleteQuestion(index: number) {
    // Find delete buttons on questions
    const deleteBtns = this.page.locator('button[title*="delete" i], button[aria-label*="delete" i], button:has(svg)').filter({
      has: this.page.locator('svg')
    });
    const count = await deleteBtns.count();
    if (count > 0 && index < count) {
      await deleteBtns.nth(index).click();
      await this.page.waitForTimeout(300);
      return true;
    }
    return false;
  }

  async addConditional() {
    const addCondBtn = this.page.locator('button').filter({ hasText: /Add Conditional|Insert Conditional/ }).first();
    if (await addCondBtn.isVisible()) {
      await addCondBtn.click();
      await this.page.waitForTimeout(300);
      return true;
    }
    return false;
  }

  async fillQuestionText(text: string) {
    // Find the most recently added question's text input
    const textInputs = this.page.locator('input[placeholder*="question text" i], textarea[placeholder*="question" i]');
    const lastInput = textInputs.last();
    if (await lastInput.isVisible()) {
      await lastInput.fill(text);
      return true;
    }
    return false;
  }

  async fillQuestionIdentifier(identifier: string) {
    // Find identifier input - use the actual placeholder from the UI
    const idInputs = this.page.locator('input[placeholder="e.g., full_name"]');
    const lastInput = idInputs.last();
    if (await lastInput.isVisible()) {
      await lastInput.fill(identifier);
      await this.page.waitForTimeout(500); // Wait for auto-save
      return true;
    }
    return false;
  }

  async saveGroup() {
    const saveBtn = this.page.locator('button').filter({ hasText: /Save|Update/ }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await this.page.waitForTimeout(500);
      return true;
    }
    return false;
  }

  async verifyNoErrors() {
    // Check for error messages or broken UI
    const errors = this.page.locator('.error, [class*="error"], [role="alert"]');
    const errorCount = await errors.count();
    return errorCount === 0;
  }

  async verifyQuestionOrder(): Promise<string[]> {
    // Get all question identifiers in order - use the actual placeholder from the UI
    const identifiers = this.page.locator('input[placeholder="e.g., full_name"]');
    const count = await identifiers.count();
    const order: string[] = [];
    for (let i = 0; i < count; i++) {
      const value = await identifiers.nth(i).inputValue();
      if (value) order.push(value);
    }
    return order;
  }
}

test.describe('Question Group UI - Randomized Interactions', () => {
  let state: TestState;

  test.beforeEach(async ({ page }) => {
    state = {
      questionCount: 0,
      conditionalCount: 0,
      actions: [],
    };
  });

  test('should handle random sequence of add/delete/insert operations', async ({ page }) => {
    initRng('random-sequence');
    const qgPage = new QuestionGroupPage(page);
    
    // Login
    await qgPage.login();
    await qgPage.navigateToQuestionGroups();
    
    // Create a new test group
    const groupName = `Test Group ${randomString(6)}`;
    await qgPage.createNewGroup(groupName);
    
    // Perform random actions
    const numActions = randomInt(TEST_CONFIG.minActions, TEST_CONFIG.maxActions);
    console.log(`Performing ${numActions} random actions...`);
    
    for (let i = 0; i < numActions; i++) {
      const availableActions: ActionType[] = ['addQuestion'];
      
      if (state.questionCount > 0) {
        availableActions.push('deleteQuestion', 'editQuestionText');
      }
      if (state.questionCount > 1) {
        availableActions.push('insertQuestionInMiddle', 'reorderQuestion');
      }
      if (state.questionCount > 0) {
        availableActions.push('addConditional');
      }
      
      const action = randomChoice(availableActions);
      console.log(`Action ${i + 1}/${numActions}: ${action}`);
      state.actions.push(action);
      
      try {
        switch (action) {
          case 'addQuestion': {
            const success = await qgPage.clickAddQuestion();
            if (success) {
              const qText = `Question ${randomString(4)}`;
              const qId = `q_${randomString(6)}`;
              await qgPage.fillQuestionText(qText);
              await qgPage.fillQuestionIdentifier(qId);
              state.questionCount++;
            }
            break;
          }
          
          case 'insertQuestionInMiddle': {
            const insertIndex = randomInt(0, state.questionCount - 1);
            const success = await qgPage.clickInsertQuestion(insertIndex);
            if (success) {
              const qText = `Inserted Q ${randomString(4)}`;
              const qId = `inserted_${randomString(6)}`;
              await qgPage.fillQuestionText(qText);
              await qgPage.fillQuestionIdentifier(qId);
              state.questionCount++;
            }
            break;
          }
          
          case 'deleteQuestion': {
            if (state.questionCount > 0) {
              const deleteIndex = randomInt(0, state.questionCount - 1);
              const success = await qgPage.deleteQuestion(deleteIndex);
              if (success) {
                state.questionCount--;
              }
            }
            break;
          }
          
          case 'addConditional': {
            const success = await qgPage.addConditional();
            if (success) {
              state.conditionalCount++;
            }
            break;
          }
          
          case 'editQuestionText': {
            // Just change some text
            const newText = `Edited ${randomString(6)}`;
            await qgPage.fillQuestionText(newText);
            break;
          }
          
          default:
            break;
        }
      } catch (error) {
        console.error(`Error during action ${action}:`, error);
      }
      
      // Small delay between actions
      await page.waitForTimeout(200);
      
      // Verify no errors after each action
      const noErrors = await qgPage.verifyNoErrors();
      expect(noErrors).toBe(true);
    }
    
    // Final verification
    console.log('Actions performed:', state.actions);
    console.log('Final question count:', state.questionCount);
    
    // Try to save
    await qgPage.saveGroup();
    
    // Verify the page is still functional
    const finalNoErrors = await qgPage.verifyNoErrors();
    expect(finalNoErrors).toBe(true);
  });

  test('should correctly add questions at end after inserting in middle (bug regression)', async ({ page }) => {
    initRng('bug-regression');
    const qgPage = new QuestionGroupPage(page);
    
    await qgPage.login();
    await qgPage.navigateToQuestionGroups();
    
    // Create or select a group
    const groupName = `Regression Test ${randomString(6)}`;
    await qgPage.createNewGroup(groupName);
    
    // Add 3 questions at the end
    for (let i = 1; i <= 3; i++) {
      expect(await qgPage.clickAddQuestion()).toBe(true);
      expect(await qgPage.fillQuestionText(`Question ${i}`)).toBe(true);
      expect(await qgPage.fillQuestionIdentifier(`q${i}`)).toBe(true);
      await page.waitForTimeout(300);
    }
    
    // Get initial order
    const initialOrder = await qgPage.verifyQuestionOrder();
    console.log('Initial order:', initialOrder);
    
    // Insert a question in the middle (after first question)
    expect(await qgPage.clickInsertQuestion(0)).toBe(true);
    expect(await qgPage.fillQuestionText('Inserted Middle')).toBe(true);
    expect(await qgPage.fillQuestionIdentifier('q_middle')).toBe(true);
    await page.waitForTimeout(300);
    
    const afterInsertOrder = await qgPage.verifyQuestionOrder();
    console.log('After insert order:', afterInsertOrder);
    
    // Now add a question at the END using the bottom Add Question button
    expect(await qgPage.clickAddQuestion()).toBe(true);
    expect(await qgPage.fillQuestionText('Question at End')).toBe(true);
    expect(await qgPage.fillQuestionIdentifier('q_end')).toBe(true);
    await page.waitForTimeout(300);
    
    const finalOrder = await qgPage.verifyQuestionOrder();
    console.log('Final order:', finalOrder);
    
    // The "q_end" should be at the END, not in the middle
    expect(finalOrder[finalOrder.length - 1]).toBe('q_end');
  });

  test('should handle rapid add/delete cycles', async ({ page }) => {
    initRng('rapid-cycles');
    const qgPage = new QuestionGroupPage(page);
    
    await qgPage.login();
    await qgPage.navigateToQuestionGroups();
    
    const groupName = `Rapid Test ${randomString(6)}`;
    await qgPage.createNewGroup(groupName);
    
    // Rapid add/delete cycles
    for (let cycle = 0; cycle < 5; cycle++) {
      console.log(`Cycle ${cycle + 1}/5`);
      
      // Add 3 questions quickly
      for (let i = 0; i < 3; i++) {
        await qgPage.clickAddQuestion();
        await qgPage.fillQuestionText(`Cycle${cycle}_Q${i}`);
        await qgPage.fillQuestionIdentifier(`c${cycle}_q${i}`);
      }
      
      // Delete 2 questions
      await qgPage.deleteQuestion(0);
      await qgPage.deleteQuestion(0);
      
      // Verify no errors
      const noErrors = await qgPage.verifyNoErrors();
      expect(noErrors).toBe(true);
    }
    
    // Save and verify
    await qgPage.saveGroup();
    const finalNoErrors = await qgPage.verifyNoErrors();
    expect(finalNoErrors).toBe(true);
  });

  test('should maintain correct order with mixed insert positions', async ({ page }) => {
    initRng('mixed-positions');
    const qgPage = new QuestionGroupPage(page);
    
    await qgPage.login();
    await qgPage.navigateToQuestionGroups();
    
    const groupName = `Order Test ${randomString(6)}`;
    await qgPage.createNewGroup(groupName);
    
    // Add initial questions
    expect(await qgPage.clickAddQuestion()).toBe(true);
    expect(await qgPage.fillQuestionText('First')).toBe(true);
    expect(await qgPage.fillQuestionIdentifier('first')).toBe(true);
    
    expect(await qgPage.clickAddQuestion()).toBe(true);
    expect(await qgPage.fillQuestionText('Second')).toBe(true);
    expect(await qgPage.fillQuestionIdentifier('second')).toBe(true);
    
    expect(await qgPage.clickAddQuestion()).toBe(true);
    expect(await qgPage.fillQuestionText('Third')).toBe(true);
    expect(await qgPage.fillQuestionIdentifier('third')).toBe(true);
    
    // Insert at position 0
    expect(await qgPage.clickInsertQuestion(0)).toBe(true);
    expect(await qgPage.fillQuestionText('After First')).toBe(true);
    expect(await qgPage.fillQuestionIdentifier('after_first')).toBe(true);
    
    // Insert at position 2
    expect(await qgPage.clickInsertQuestion(2)).toBe(true);
    expect(await qgPage.fillQuestionText('After Second')).toBe(true);
    expect(await qgPage.fillQuestionIdentifier('after_second')).toBe(true);
    
    // Add at end
    expect(await qgPage.clickAddQuestion()).toBe(true);
    expect(await qgPage.fillQuestionText('Last')).toBe(true);
    expect(await qgPage.fillQuestionIdentifier('last')).toBe(true);
    
    const order = await qgPage.verifyQuestionOrder();
    console.log('Final order:', order);
    
    // Verify "last" is actually last
    expect(order[order.length - 1]).toBe('last');
    
    // Verify no errors
    const noErrors = await qgPage.verifyNoErrors();
    expect(noErrors).toBe(true);
  });
});

test.describe('Question Group UI - Stress Tests', () => {
  test('should handle many questions without breaking', async ({ page }) => {
    initRng('stress-test');
    const qgPage = new QuestionGroupPage(page);
    
    await qgPage.login();
    await qgPage.navigateToQuestionGroups();
    
    const groupName = `Stress Test ${randomString(6)}`;
    await qgPage.createNewGroup(groupName);
    
    // Add many questions
    const numQuestions = 15;
    for (let i = 0; i < numQuestions; i++) {
      expect(await qgPage.clickAddQuestion()).toBe(true);
      expect(await qgPage.fillQuestionText(`Stress Q${i + 1}`)).toBe(true);
      expect(await qgPage.fillQuestionIdentifier(`stress_q${i + 1}`)).toBe(true);
      
      if (i % 5 === 0) {
        console.log(`Added ${i + 1}/${numQuestions} questions`);
      }
    }
    
    // Verify count
    const finalOrder = await qgPage.verifyQuestionOrder();
    expect(finalOrder.length).toBe(numQuestions);
    
    // Save
    await qgPage.saveGroup();
    
    // Verify no errors
    const noErrors = await qgPage.verifyNoErrors();
    expect(noErrors).toBe(true);
  });
});
