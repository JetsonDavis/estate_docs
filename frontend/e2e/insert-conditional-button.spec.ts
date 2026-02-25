import { test, expect, Page } from '@playwright/test'

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3005',
  backendUrl: 'http://localhost:8005',
  adminEmail: 'admin',
  adminPassword: 'password',
}

async function login(page: Page) {
  await page.goto(`${TEST_CONFIG.baseUrl}/login`)
  await page.fill('input[id="username"]', TEST_CONFIG.adminEmail)
  await page.fill('input[id="password"]', TEST_CONFIG.adminPassword)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
}

// Track created group IDs for cleanup
let createdGroupIds: number[] = []

async function deleteGroupById(page: Page, groupId: number): Promise<void> {
  try {
    await page.request.delete(`${TEST_CONFIG.backendUrl}/api/v1/question-groups/${groupId}`)
  } catch (e) {
    console.log(`Failed to delete group ${groupId}:`, e)
  }
}

/**
 * Creates a group with a question, a conditional on that question, and a nested question
 * inside the conditional. Returns the group ID extracted from the URL.
 */
async function createGroupWithConditionalAndNestedQuestion(page: Page, uniqueId: string): Promise<void> {
  await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`)
  await page.waitForLoadState('networkidle')

  // Create group
  await page.click('text=Create Questions Group')
  await page.waitForTimeout(500)

  const nameInput = page.locator('input.form-input').first()
  await nameInput.fill(`InsertCond_${uniqueId}`)
  await page.waitForTimeout(500)

  const checkingName = page.getByText('Checking name...')
  if (await checkingName.isVisible().catch(() => false)) {
    await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined)
  }
  await page.waitForTimeout(500)

  await page.click('text=Save Group Information')
  await page.waitForSelector('text=Questions', { timeout: 10000 })
  await page.waitForTimeout(1000)

  // Extract group ID from URL for cleanup
  const url = page.url()
  const match = url.match(/\/question-groups\/(\d+)/)
  if (match) {
    createdGroupIds.push(parseInt(match[1], 10))
  }

  // Add a root-level question
  const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.click()
  await page.waitForTimeout(1000)

  const identifierInput = page.locator('input[placeholder*="full_name"]').first()
  await identifierInput.fill(`root_q_${uniqueId}`)
  const questionTextarea = page.locator('.question-builder textarea').first()
  await questionTextarea.fill('Root Question')
  await page.waitForTimeout(2000)

  // Add a conditional after the question
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const conditionalBtn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first()
  await conditionalBtn.click()
  await page.waitForTimeout(1500)

  // Fill the conditional value
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const valueInput = page.locator('input[placeholder*="value"]').first()
  await valueInput.fill('yes')
  await page.waitForTimeout(1000)

  // The conditional auto-creates a nested question. Fill its identifier.
  const allIdentifiers = page.locator('input[placeholder*="full_name"], input[placeholder*="nested_field"]')
  const count = await allIdentifiers.count()
  if (count > 1) {
    await allIdentifiers.nth(count - 1).fill(`nested_q_${uniqueId}`)
    const allTextareas = page.locator('.question-builder textarea')
    const textareaCount = await allTextareas.count()
    await allTextareas.nth(textareaCount - 1).fill('Nested Question')
    await page.waitForTimeout(2000)
  }

  // Verify we have a conditional block with nested content
  const conditionalBlocks = page.locator('.conditional-block')
  expect(await conditionalBlocks.count()).toBeGreaterThanOrEqual(1)
}

test.describe('Insert Conditional Button', () => {
  test.beforeEach(async ({ page }) => {
    createdGroupIds = []
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    for (const groupId of createdGroupIds) {
      await deleteGroupById(page, groupId)
    }
    createdGroupIds = []
  })

  test('should insert conditional at ROOT level with gray background', async ({ page }) => {
    const uniqueId = Date.now().toString()
    await createGroupWithConditionalAndNestedQuestion(page, uniqueId)

    // Count existing root-level conditionals before insertion
    const beforeCount = await page.evaluate(() => {
      const allConditionals = Array.from(document.querySelectorAll('.conditional-block'))
      return allConditionals.filter(c => {
        const parent = c.parentElement
        return parent && parent.className.includes('question-builder')
      }).length
    })

    // Click the "Insert a nested conditional here" button (purple arrow inside a conditional)
    const insertBtn = page.locator('button[title="Insert a nested conditional here"]').first()
    if (await insertBtn.isVisible().catch(() => false)) {
      await insertBtn.click()
    } else {
      // Fallback: try the other insert conditional button
      const altBtn = page.locator('button[title="Insert a new conditional here"]').first()
      await altBtn.click()
    }

    await page.waitForTimeout(1500)

    // Count root-level conditionals after insertion
    const afterCount = await page.evaluate(() => {
      const allConditionals = Array.from(document.querySelectorAll('.conditional-block'))
      return allConditionals.filter(c => {
        const parent = c.parentElement
        return parent && parent.className.includes('question-builder')
      }).length
    })

    // Should have one more root-level conditional
    expect(afterCount).toBe(beforeCount + 1)

    // Find the newly created conditional and verify it has gray background (depth 0)
    const newConditionalBgColor = await page.evaluate(() => {
      const allConditionals = Array.from(document.querySelectorAll('.conditional-block'))
      const rootConditionals = allConditionals.filter(c => {
        const parent = c.parentElement
        return parent && parent.className.includes('question-builder')
      })

      // Get the last root conditional (the one we just created)
      const lastRootConditional = rootConditionals[rootConditionals.length - 1]
      return window.getComputedStyle(lastRootConditional).backgroundColor
    })

    // Gray background for depth 0: rgb(249, 250, 251)
    expect(newConditionalBgColor).toBe('rgb(249, 250, 251)')

    console.log('Insert conditional at root level: passed')
  })

  test('should insert conditional after the parent conditional', async ({ page }) => {
    const uniqueId = Date.now().toString()
    await createGroupWithConditionalAndNestedQuestion(page, uniqueId)

    // Find the conditional and get its number
    const conditionalNumber = await page.evaluate(() => {
      const conditionals = Array.from(document.querySelectorAll('.conditional-block'))
      if (conditionals.length > 0) {
        const match = conditionals[0].textContent?.match(/Conditional \((\d+)\)/)
        return match ? parseInt(match[1]) : null
      }
      return null
    })

    expect(conditionalNumber).not.toBeNull()

    await page.waitForTimeout(500)

    // Click the "Insert a nested conditional here" button
    const insertBtn = page.locator('button[title="Insert a nested conditional here"]').first()
    if (await insertBtn.isVisible().catch(() => false)) {
      await insertBtn.click()
    } else {
      const altBtn = page.locator('button[title="Insert a new conditional here"]').first()
      await altBtn.click()
    }

    await page.waitForTimeout(1500)

    // Verify the new conditional appears right after the parent conditional
    const newConditionalNumber = await page.evaluate((parentNum) => {
      if (parentNum === null) return null

      const conditionals = Array.from(document.querySelectorAll('.conditional-block'))
      const rootConditionals = conditionals.filter(c => {
        const parent = c.parentElement
        return parent && parent.className.includes('question-builder')
      })

      // Find conditionals after the parent
      for (let i = 0; i < rootConditionals.length; i++) {
        const text = rootConditionals[i].textContent
        const match = text?.match(/Conditional \((\d+)\)/)
        if (match) {
          const num = parseInt(match[1])
          if (num === parentNum + 1) {
            return num
          }
        }
      }
      return null
    }, conditionalNumber)

    // The new conditional should be numbered one more than the parent
    expect(newConditionalNumber).toBe((conditionalNumber ?? 0) + 1)

    console.log('Insert conditional after parent: passed')
  })
})
