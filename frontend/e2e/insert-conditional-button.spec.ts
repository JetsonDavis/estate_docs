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

  // Add a second root-level question so the "Insert Conditional" button appears
  // (it only renders between questions, i.e. when qIndex > 0)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const addBtn2 = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn2.click()
  await page.waitForTimeout(1000)

  const allIdentifiers2 = page.locator('input[placeholder*="full_name"]')
  const idCount2 = await allIdentifiers2.count()
  await allIdentifiers2.nth(idCount2 - 1).scrollIntoViewIfNeeded()
  await allIdentifiers2.nth(idCount2 - 1).fill(`second_q_${uniqueId}`)
  await page.waitForTimeout(2000)
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

    // Use the root-level "Insert Conditional" button that appears between root items
    // This button has title="Insert a new conditional here"
    const insertBtn = page.locator('button[title="Insert a new conditional here"]').first()
    await insertBtn.scrollIntoViewIfNeeded()
    await insertBtn.click()

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

    // Verify the new conditional is placed directly ABOVE the second question,
    // not directly below Q1 (which would place it before the existing conditional).
    // The setup creates: Q1 -> Conditional(value=yes) -> Q2
    // After insertion we expect: Q1 -> Conditional(value=yes) -> NEW Conditional -> Q2
    // If the bug is present it would be: Q1 -> NEW Conditional -> Conditional(value=yes) -> Q2
    //
    // We verify by collecting all conditional-block and question-builder elements in DOM order
    // between Q1 and Q2, then checking that the LAST conditional before Q2 is the new one (empty nested identifier).
    const placement = await page.evaluate((uid: string) => {
      // Find Q1 and Q2 identifier inputs
      const allIdInputs = Array.from(document.querySelectorAll('input[placeholder*="full_name"]'))
      const q1Input = allIdInputs.find(el => (el as HTMLInputElement).value.startsWith('root_q_'))
      const q2Input = allIdInputs.find(el => (el as HTMLInputElement).value.startsWith('second_q_'))
      if (!q1Input || !q2Input) return { error: 'questions not found' }

      // Get all conditional blocks in DOM order that appear AFTER Q1 and BEFORE Q2
      const allConditionalBlocks = Array.from(document.querySelectorAll('.conditional-block'))
      const conditionalsBetween = allConditionalBlocks.filter(block => {
        const afterQ1 = (q1Input.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        const beforeQ2 = (block.compareDocumentPosition(q2Input) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        return afterQ1 && beforeQ2
      })

      // The last conditional between Q1 and Q2 should be the newly inserted one.
      // The new conditional has a nested question with an EMPTY identifier (placeholder "nested_field").
      // The original conditional has a nested question with identifier "nested_q_*".
      const lastCond = conditionalsBetween[conditionalsBetween.length - 1]
      const lastNestedIdInput = lastCond?.querySelector('input[placeholder*="nested_field"]') as HTMLInputElement | null
      const lastNestedIdIsEmpty = lastNestedIdInput ? lastNestedIdInput.value === '' : false

      const firstCond = conditionalsBetween[0]
      const firstNestedIdInput = firstCond?.querySelector('input[placeholder*="nested_field"]') as HTMLInputElement | null
      const firstNestedIdValue = firstNestedIdInput ? firstNestedIdInput.value : ''

      return {
        conditionalsBetweenCount: conditionalsBetween.length,
        lastConditionalNestedIdIsEmpty: lastNestedIdIsEmpty,
        firstConditionalNestedId: firstNestedIdValue,
      }
    }, uniqueId)

    // There should be at least 2 conditionals between Q1 and Q2
    expect((placement as any).conditionalsBetweenCount).toBeGreaterThanOrEqual(2)
    // The LAST conditional before Q2 should be the new one (empty nested identifier)
    expect(placement).toHaveProperty('lastConditionalNestedIdIsEmpty', true)
    // The FIRST conditional should be the original one (with the filled nested_q_* identifier)
    expect((placement as any).firstConditionalNestedId).toContain('nested_q_')

    console.log('Insert conditional at root level: passed')
  })

  test('should insert follow-on conditional inside parent conditional', async ({ page }) => {
    const uniqueId = Date.now().toString()
    await createGroupWithConditionalAndNestedQuestion(page, uniqueId)

    // Count existing conditional blocks before insertion
    const beforeCount = await page.evaluate(() => {
      return document.querySelectorAll('.conditional-block').length
    })

    // Use "Add Follow-on Conditional" button inside the existing conditional
    const followOnBtn = page.locator('button').filter({ hasText: 'Add Follow-on Conditional' }).first()
    await followOnBtn.scrollIntoViewIfNeeded()
    await followOnBtn.click()

    await page.waitForTimeout(1500)

    // Count conditional blocks after insertion
    const afterCount = await page.evaluate(() => {
      return document.querySelectorAll('.conditional-block').length
    })

    // Should have one more conditional block
    expect(afterCount).toBe(beforeCount + 1)

    // Verify we now have 2 conditional blocks visible
    const conditionalBlocks = page.locator('.conditional-block')
    expect(await conditionalBlocks.count()).toBeGreaterThanOrEqual(2)

    console.log('Insert follow-on conditional: passed')
  })
})
