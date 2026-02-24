import { test, expect } from '@playwright/test'

test.describe('Insert Conditional Button', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3005/login')
    await page.fill('input[type="text"]', 'admin')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/admin/question-groups')
  })

  test('should insert conditional at same level as nested question', async ({ page }) => {
    // Create a new question group
    await page.click('text=Create New Group')
    await page.fill('input[placeholder="Enter group name"]', 'Insert Conditional Test')
    
    // Add first question
    await page.click('button:has-text("Add Question")')
    await page.fill('input[placeholder="e.g., full_name"]', 'question_1')
    await page.fill('textarea[placeholder="Enter your question here..."]', 'Question 1?')
    
    // Add a conditional
    await page.click('button:has-text("Add Conditional")')
    
    // Fill in conditional details
    const conditionalBlock = page.locator('.conditional-block').first()
    await conditionalBlock.locator('select').first().selectOption('question_1')
    await conditionalBlock.locator('select').nth(1).selectOption('equals')
    await conditionalBlock.locator('input[placeholder="Enter value"]').fill('test')
    
    // Add a nested question inside the conditional
    await conditionalBlock.locator('button:has-text("Insert Question")').first().click()
    
    // Fill in the nested question
    const nestedQuestion = page.locator('.question-builder').filter({ hasText: 'Nested Question' }).first()
    await nestedQuestion.locator('input[placeholder="e.g., full_name"]').fill('nested_question_1')
    await nestedQuestion.locator('textarea[placeholder="Enter your question here..."]').fill('Nested Question 1?')
    
    // Wait a bit for the question to be saved
    await page.waitForTimeout(500)
    
    // Now click "Insert Conditional" button that appears below the nested question
    // This button should insert a conditional at the same level as the nested question
    await page.locator('button:has-text("Insert Conditional")').first().click()
    
    // Wait for the conditional to be created
    await page.waitForTimeout(500)
    
    // Verify that a new conditional was created at the same nesting level
    // It should be inside the same parent conditional, not at the root level
    const nestedConditionals = await conditionalBlock.locator('.conditional-block').count()
    
    // Should have at least 1 nested conditional (the one we just created)
    expect(nestedConditionals).toBeGreaterThanOrEqual(1)
    
    // Verify the nested conditional has the correct depth by checking its background color
    // Nested items at depth 1 should have a specific background color
    const insertedConditional = conditionalBlock.locator('.conditional-block').first()
    const bgColor = await insertedConditional.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor
    })
    
    // The background should be the depth-1 color (light green)
    // rgb(220, 252, 231) is the expected color for depth 1
    expect(bgColor).toBe('rgb(220, 252, 231)')
    
    // Verify the conditional appears in the correct position
    // It should be after the nested question, not at the root level
    const allConditionals = await page.locator('.conditional-block').all()
    
    // The first conditional should be the parent (at root level)
    // The second conditional should be the nested one we just created
    expect(allConditionals.length).toBeGreaterThanOrEqual(2)
    
    // Clean up - don't save
    await page.click('button:has-text("Cancel")')
  })

  test('should use previous question as ifIdentifier for inserted conditional', async ({ page }) => {
    // Create a new question group
    await page.click('text=Create New Group')
    await page.fill('input[placeholder="Enter group name"]', 'Insert Conditional ifIdentifier Test')
    
    // Add first question
    await page.click('button:has-text("Add Question")')
    await page.fill('input[placeholder="e.g., full_name"]', 'question_1')
    await page.fill('textarea[placeholder="Enter your question here..."]', 'Question 1?')
    
    // Add a conditional
    await page.click('button:has-text("Add Conditional")')
    
    // Fill in conditional details
    const conditionalBlock = page.locator('.conditional-block').first()
    await conditionalBlock.locator('select').first().selectOption('question_1')
    await conditionalBlock.locator('select').nth(1).selectOption('equals')
    await conditionalBlock.locator('input[placeholder="Enter value"]').fill('test')
    
    // Add first nested question
    await conditionalBlock.locator('button:has-text("Insert Question")').first().click()
    const nestedQuestion1 = page.locator('.question-builder').filter({ hasText: 'Nested Question' }).first()
    await nestedQuestion1.locator('input[placeholder="e.g., full_name"]').fill('nested_q1')
    await nestedQuestion1.locator('textarea[placeholder="Enter your question here..."]').fill('Nested Q1?')
    
    await page.waitForTimeout(500)
    
    // Add second nested question
    await conditionalBlock.locator('button:has-text("Insert Question")').nth(1).click()
    const nestedQuestion2 = page.locator('.question-builder').filter({ hasText: 'Nested Question' }).nth(1)
    await nestedQuestion2.locator('input[placeholder="e.g., full_name"]').fill('nested_q2')
    await nestedQuestion2.locator('textarea[placeholder="Enter your question here..."]').fill('Nested Q2?')
    
    await page.waitForTimeout(500)
    
    // Click "Insert Conditional" button between the two nested questions
    await page.locator('button:has-text("Insert Conditional")').nth(1).click()
    
    await page.waitForTimeout(500)
    
    // Verify the inserted conditional has nested_q1 as its ifIdentifier
    const insertedConditional = conditionalBlock.locator('.conditional-block').first()
    const ifIdentifierSelect = insertedConditional.locator('select').first()
    const selectedValue = await ifIdentifierSelect.inputValue()
    
    expect(selectedValue).toBe('nested_q1')
    
    // Clean up
    await page.click('button:has-text("Cancel")')
  })
})
