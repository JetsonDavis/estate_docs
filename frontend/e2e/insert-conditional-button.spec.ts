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

    // Count existing conditionals before insertion
    const beforeCount = await page.locator('.conditional-block').count()

    // Use the root-level "Insert Conditional" button that appears between root items
    // This button has title="Insert a new conditional here"
    const insertBtn = page.locator('button[title="Insert a new conditional here"]').first()
    await insertBtn.scrollIntoViewIfNeeded()
    await insertBtn.click()

    await page.waitForTimeout(1500)

    // Count conditionals after insertion
    const afterCount = await page.locator('.conditional-block').count()

    // Should have one more conditional
    expect(afterCount).toBe(beforeCount + 1)

    // Find the newly created conditional (last one) and verify it has gray background (depth 0)
    const lastConditional = page.locator('.conditional-block').last()
    const newConditionalBgColor = await lastConditional.evaluate(
      (el) => window.getComputedStyle(el).backgroundColor
    )

    // Gray background for depth 0: rgb(249, 250, 251)
    expect(newConditionalBgColor).toBe('rgb(249, 250, 251)')

    // The "Insert Conditional" button at the bottom of Q1's card inserts at
    // Q1_logicIndex + 1, placing the NEW conditional right after Q1 and BEFORE
    // Q1's existing conditional. This gives the order:
    //   Q1 -> NEW Conditional -> original Conditional(value=yes) -> Q2
    //
    // We verify by checking the DOM order of conditional blocks between Q1 and Q2.
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

      // The FIRST conditional between Q1 and Q2 is the newly inserted one (empty nested identifier).
      // The LAST conditional is the original one with identifier "nested_q_*".
      const firstCond = conditionalsBetween[0]
      const firstNestedIdInput = firstCond?.querySelector('input[placeholder*="nested_field"]') as HTMLInputElement | null
      const firstNestedIdIsEmpty = firstNestedIdInput ? firstNestedIdInput.value === '' : false

      const lastCond = conditionalsBetween[conditionalsBetween.length - 1]
      const lastNestedIdInput = lastCond?.querySelector('input[placeholder*="nested_field"]') as HTMLInputElement | null
      const lastNestedIdValue = lastNestedIdInput ? lastNestedIdInput.value : ''

      return {
        conditionalsBetweenCount: conditionalsBetween.length,
        firstConditionalNestedIdIsEmpty: firstNestedIdIsEmpty,
        lastConditionalNestedId: lastNestedIdValue,
      }
    }, uniqueId)

    // There should be at least 2 conditionals between Q1 and Q2
    expect((placement as any).conditionalsBetweenCount).toBeGreaterThanOrEqual(2)
    // The FIRST conditional after Q1 should be the new one (empty nested identifier)
    expect(placement).toHaveProperty('firstConditionalNestedIdIsEmpty', true)
    // The LAST conditional before Q2 should be the original one (with the filled nested_q_* identifier)
    expect((placement as any).lastConditionalNestedId).toContain('nested_q_')

    console.log('Insert conditional at root level: passed')
  })

  test('should insert conditional inside parent conditional via top-of-conditional button', async ({ page }) => {
    const uniqueId = Date.now().toString()
    await createGroupWithConditionalAndNestedQuestion(page, uniqueId)

    // Count existing conditional blocks before insertion
    const beforeCount = await page.evaluate(() => {
      return document.querySelectorAll('.conditional-block').length
    })

    // The "Add Follow-on Conditional" button was removed.
    // Use "Insert a conditional inside this conditional" (the button in the conditional header
    // area, between the header fields and the first nested item). It inserts at position 0
    // within the nestedItems — i.e., before the first nested item.
    const innerCondBtn = page.locator('button[title="Insert a conditional inside this conditional"]').first()
    await innerCondBtn.scrollIntoViewIfNeeded()
    await innerCondBtn.click()

    await page.waitForTimeout(1500)

    // Count conditional blocks after insertion
    const afterCount = await page.evaluate(() => {
      return document.querySelectorAll('.conditional-block').length
    })

    // Should have one more conditional block (nested inside the outer one)
    expect(afterCount).toBe(beforeCount + 1)

    // The outer conditional should now contain a nested conditional block
    const outerCond = page.locator('.conditional-block').first()
    const nestedCondInsideOuter = outerCond.locator('.conditional-block')
    expect(await nestedCondInsideOuter.count()).toBeGreaterThanOrEqual(1)

    // The new nested conditional should appear BEFORE the existing nested question
    // (because it was inserted at position 0 in nestedItems)
    const firstNestedIsConditional = await page.evaluate((uid: string) => {
      const outer = document.querySelector('.conditional-block')
      if (!outer) return false
      const children = Array.from(outer.querySelectorAll(':scope > div > *'))
      // Find the first child that is either a nested conditional or a nested question input
      for (const child of outer.querySelectorAll('.conditional-block, input[placeholder*="nested_field"]')) {
        // If it's a conditional-block, the new conditional is first
        if (child.classList.contains('conditional-block')) return true
        // If it's a nested_field input, the original question came first (unexpected)
        return false
      }
      return false
    }, uniqueId)
    expect(firstNestedIsConditional).toBe(true)

    console.log('Insert conditional inside parent: passed')
  })
})
