import { test, expect } from '@playwright/test'

test.describe('Insert Conditional Button', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('http://localhost:3005/login')
    await page.getByRole('textbox', { name: 'Email Address or Username' }).fill('admin')
    await page.getByRole('textbox', { name: 'Password' }).fill('password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL('http://localhost:3005/')
    
    // Navigate to Question Groups
    await page.getByRole('link', { name: 'Question Groups' }).click()
    await page.waitForURL('**/admin/question-groups')
    
    // Click on the test group
    await page.getByText('jeff_shay_test_02242026').click()
    await page.waitForURL('**/admin/question-groups/*/edit')
  })

  test('should insert conditional at ROOT level with gray background', async ({ page }) => {
    // Scroll to find a conditional with a nested question
    await page.evaluate(() => {
      const conditionals = Array.from(document.querySelectorAll('.conditional-block'));
      const condWithNested = conditionals.find(c => c.textContent.includes('Nested Question'));
      if (condWithNested) {
        condWithNested.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    })
    
    await page.waitForTimeout(1000)
    
    // Count existing root-level conditionals before insertion
    const beforeCount = await page.evaluate(() => {
      const allConditionals = Array.from(document.querySelectorAll('.conditional-block'));
      return allConditionals.filter(c => {
        const parent = c.parentElement;
        return parent && parent.className.includes('question-builder');
      }).length;
    })
    
    // Click the first "Insert Conditional" button we find inside a conditional
    await page.getByTitle('Insert a nested conditional').first().click()
    
    await page.waitForTimeout(1000)
    
    // Count root-level conditionals after insertion
    const afterCount = await page.evaluate(() => {
      const allConditionals = Array.from(document.querySelectorAll('.conditional-block'));
      return allConditionals.filter(c => {
        const parent = c.parentElement;
        return parent && parent.className.includes('question-builder');
      }).length;
    })
    
    // Should have one more root-level conditional
    expect(afterCount).toBe(beforeCount + 1)
    
    // Find the newly created conditional and verify it has gray background (depth 0)
    const newConditionalBgColor = await page.evaluate(() => {
      const allConditionals = Array.from(document.querySelectorAll('.conditional-block'));
      const rootConditionals = allConditionals.filter(c => {
        const parent = c.parentElement;
        return parent && parent.className.includes('question-builder');
      });
      
      // Get the last root conditional (the one we just created)
      const lastRootConditional = rootConditionals[rootConditionals.length - 1];
      return window.getComputedStyle(lastRootConditional).backgroundColor;
    })
    
    // Gray background for depth 0: rgb(249, 250, 251)
    expect(newConditionalBgColor).toBe('rgb(249, 250, 251)')
  })

  test('should insert conditional after the parent conditional', async ({ page }) => {
    // Find a conditional with nested questions
    const conditionalNumber = await page.evaluate(() => {
      const conditionals = Array.from(document.querySelectorAll('.conditional-block'));
      const condWithNested = conditionals.find(c => c.textContent.includes('Nested Question'));
      
      if (condWithNested) {
        condWithNested.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Extract the conditional number
        const match = condWithNested.textContent.match(/Conditional \((\d+)\)/);
        return match ? parseInt(match[1]) : null;
      }
      return null;
    })
    
    expect(conditionalNumber).not.toBeNull()
    
    await page.waitForTimeout(1000)
    
    // Click Insert Conditional
    await page.getByTitle('Insert a nested conditional').first().click()
    
    await page.waitForTimeout(1000)
    
    // Verify the new conditional appears right after the parent conditional
    const newConditionalNumber = await page.evaluate((parentNum) => {
      if (parentNum === null) return null;
      
      const conditionals = Array.from(document.querySelectorAll('.conditional-block'));
      const rootConditionals = conditionals.filter(c => {
        const parent = c.parentElement;
        return parent && parent.className.includes('question-builder');
      });
      
      // Find conditionals after the parent
      for (let i = 0; i < rootConditionals.length; i++) {
        const text = rootConditionals[i].textContent;
        const match = text.match(/Conditional \((\d+)\)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num === parentNum + 1) {
            return num;
          }
        }
      }
      return null;
    }, conditionalNumber)
    
    // The new conditional should be numbered one more than the parent
    expect(newConditionalNumber).toBe((conditionalNumber ?? 0) + 1)
  })
})
