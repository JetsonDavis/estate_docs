/**
 * E2E tests for admin question-group builder insertion fixes (2026-04-04 / 2026-04-05)
 *
 * Covers:
 *  1. Insert Question between two main-level questions lands between them, not after the second
 *  1b. Same when Q1 has a following conditional (regression: stale logic / wrong index)
 *  2. After-conditional insert buttons place items immediately after the conditional block
 *  3. Top-of-conditional insert buttons insert at the BEGINNING (before first nested item)
 *  4. "Add Follow-on Question" blue button is gone from the UI
 *  5. Nested-level Insert Question after 1-1-1 lands after 1-1-1, not after 1-1-2
 *  6. Insert Conditional via after-conditional buttons lands right after the last conditional
 */

import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3005'
const BACKEND_URL = 'http://localhost:8005'
const ADMIN = { email: 'admin', password: 'password' }

// ─── helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="username"]', ADMIN.email)
  await page.fill('input[id="password"]', ADMIN.password)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

async function deleteGroup(page: Page, id: number) {
  try {
    await page.request.delete(`${BACKEND_URL}/api/v1/question-groups/${id}`)
  } catch { /* best-effort */ }
}

/** Creates a new question group and returns its numeric ID from the URL. */
async function createGroup(page: Page, name: string): Promise<number> {
  await page.goto(`${BASE_URL}/admin/question-groups`)
  await page.waitForLoadState('networkidle')
  await page.click('text=Create Questions Group')
  await page.waitForTimeout(300)

  const nameInput = page.locator('input.form-input').first()
  await nameInput.fill(name)
  await page.waitForTimeout(300)

  const checking = page.getByText('Checking name...')
  if (await checking.isVisible().catch(() => false)) {
    await checking.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined)
  }
  await page.waitForTimeout(300)

  await page.click('text=Save Group Information')
  await page.waitForSelector('text=Questions', { timeout: 10000 })
  await page.waitForTimeout(800)

  const match = page.url().match(/\/question-groups\/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/** Adds a question (fills identifier + text) and waits for auto-save. */
async function addQuestion(page: Page, identifier: string, text: string) {
  const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.scrollIntoViewIfNeeded()
  await addBtn.click()
  await page.waitForTimeout(800)

  const idInputs = page.locator('input[placeholder*="full_name"], input[placeholder*="e.g., full_name"]')
  const count = await idInputs.count()
  await idInputs.nth(count - 1).fill(identifier)

  const textareas = page.locator('.question-builder textarea')
  const tcnt = await textareas.count()
  await textareas.nth(tcnt - 1).fill(text)
  await page.waitForTimeout(2000) // wait for auto-save
}

/** Adds a conditional (via "Add Conditional" button) and fills the trigger value. */
async function addConditional(page: Page, triggerValue: string) {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  const btn = page.locator('button').filter({ hasText: /^Add Conditional$/ }).first()
  await btn.click()
  await page.waitForTimeout(1200)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  const valueInput = page.locator('input[placeholder*="value"]').first()
  await valueInput.fill(triggerValue)
  await page.waitForTimeout(800)
}

// ─── shared group ID holder ────────────────────────────────────────────────────

let groupId = 0

// ─── tests ────────────────────────────────────────────────────────────────────

test.describe('Admin builder – insertion position fixes', () => {
  test.beforeEach(async ({ page }) => {
    groupId = 0
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    if (groupId) await deleteGroup(page, groupId)
  })

  // ── 1. Main-level Insert Question between Q1 and Q2 ────────────────────────
  test('Insert Question at bottom of Q1 lands between Q1 and Q2, not after Q2', async ({ page }) => {
    const uid = Date.now().toString()
    groupId = await createGroup(page, `InsertBetween_${uid}`)

    // Add Q1 (saved)
    await addQuestion(page, `q1_${uid}`, 'Question 1')

    // Add Q2 via "Add Question"
    await addQuestion(page, `q2_${uid}`, 'Question 2')

    // Count identifiers before insertion
    const idInputsBefore = page.locator(
      'input[placeholder*="full_name"], input[placeholder*="e.g., full_name"]'
    )
    const beforeCount = await idInputsBefore.count()
    expect(beforeCount).toBe(2)

    // Click "Insert Question" at the bottom of Q1's card (title="Insert a new question after this one")
    const insertBtns = page.locator('button[title="Insert a new question after this one"]')
    await insertBtns.first().scrollIntoViewIfNeeded()
    await insertBtns.first().click()
    await page.waitForTimeout(1000)

    // There should now be 3 identifier inputs
    const idInputsAfter = page.locator(
      'input[placeholder*="full_name"], input[placeholder*="e.g., full_name"]'
    )
    expect(await idInputsAfter.count()).toBe(3)

    // Verify DOM order: Q1 → NEW (empty) → Q2
    const order = await page.evaluate((uid: string) => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[placeholder*="full_name"], input[placeholder*="e.g., full_name"]'
        )
      )
      return inputs.map(el => el.value)
    }, uid)

    // order[0] should be q1, order[1] should be empty (new), order[2] should be q2
    expect(order[0]).toContain(`q1_${uid}`)
    expect(order[1]).toBe('')
    expect(order[2]).toContain(`q2_${uid}`)
  })

  test('Insert after Q1 with conditional: new question lands before Q2 (not after Q2)', async ({ page }) => {
    const uid = Date.now().toString()
    groupId = await createGroup(page, `InsertBetweenCond_${uid}`)

    await addQuestion(page, `q1_${uid}`, 'Question 1')
    await addConditional(page, 'yes')

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const nestedInputs = page.locator('input[placeholder*="nested_field"]')
    if (await nestedInputs.count() > 0) {
      await nestedInputs.last().fill(`nested_${uid}`)
      await page.waitForTimeout(1500)
    }

    await addQuestion(page, `q2_${uid}`, 'Question 2')

    const insertBtns = page.locator('button[title="Insert a new question after this one"]')
    await insertBtns.first().scrollIntoViewIfNeeded()
    await insertBtns.first().click()
    await page.waitForTimeout(1500)

    const order = await page.evaluate((u: string) => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          'input[placeholder*="full_name"], input[placeholder*="e.g., full_name"]'
        )
      )
      return inputs.map(el => el.value)
    }, uid)

    const q1Idx = order.findIndex(v => v.includes(`q1_${uid}`))
    const q2Idx = order.findIndex(v => v.includes(`q2_${uid}`))
    const emptyIdx = order.findIndex(v => v === '')
    expect(q1Idx).toBeGreaterThanOrEqual(0)
    expect(q2Idx).toBeGreaterThanOrEqual(0)
    expect(emptyIdx).toBeGreaterThanOrEqual(0)
    expect(q1Idx).toBeLessThan(emptyIdx)
    expect(emptyIdx).toBeLessThan(q2Idx)
  })

  // ── 2. After-conditional insert buttons land right after the conditional ────
  test('After-conditional Insert Question lands immediately after the conditional block', async ({ page }) => {
    const uid = Date.now().toString()
    groupId = await createGroup(page, `AfterCond_${uid}`)

    // Q1 (saved) + a conditional
    await addQuestion(page, `q1_${uid}`, 'Question 1')
    await addConditional(page, 'yes')

    // Fill the auto-created nested question's identifier
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const nestedInputs = page.locator('input[placeholder*="nested_field"]')
    if (await nestedInputs.count() > 0) {
      await nestedInputs.last().fill(`nested_${uid}`)
      await page.waitForTimeout(1500)
    }

    // Record how many question-builder cards exist before insertion
    const cardsBefore = await page.locator('.question-builder').count()

    // Click the "Insert Question" in the after-conditional row
    // (title="Insert a new question at this level")
    const afterCondBtn = page.locator('button[title="Insert a new question at this level"]')
    await afterCondBtn.scrollIntoViewIfNeeded()
    await afterCondBtn.click()
    await page.waitForTimeout(1000)

    // There should be one more card
    const cardsAfter = await page.locator('.question-builder').count()
    expect(cardsAfter).toBe(cardsBefore + 1)

    // The new card should appear AFTER the conditional block in the DOM.
    // Verify: the last question-builder appears after the last conditional-block.
    const newCardAfterCond = await page.evaluate(() => {
      const lastCard = Array.from(document.querySelectorAll('.question-builder')).pop()
      const lastCond = Array.from(document.querySelectorAll('.conditional-block')).pop()
      if (!lastCard || !lastCond) return false
      return (lastCond.compareDocumentPosition(lastCard) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    })
    expect(newCardAfterCond).toBe(true)
  })

  // ── 3. Top-of-conditional Insert Question lands BEFORE existing nested items ─
  test('Insert Question via top-of-conditional buttons lands BEFORE first nested item', async ({ page }) => {
    const uid = Date.now().toString()
    groupId = await createGroup(page, `TopInsert_${uid}`)

    // Q1 (saved) + conditional with a nested question
    await addQuestion(page, `q1_${uid}`, 'Question 1')
    await addConditional(page, 'yes')

    // Fill nested question identifier
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const nestedInputs = page.locator('input[placeholder*="nested_field"]')
    if (await nestedInputs.count() > 0) {
      await nestedInputs.last().fill(`nested_${uid}`)
      await page.waitForTimeout(1500)
    }

    // Count nested question identifier inputs before insertion (each nested Q has one)
    const nestedBefore = await page.locator('.conditional-block input[placeholder*="nested_field"]').count()
    expect(nestedBefore).toBe(1)

    // Click the Insert Question button inside the conditional header area
    // (title="Insert a question inside this conditional")
    const innerInsertBtn = page.locator('button[title="Insert a question inside this conditional"]')
    await innerInsertBtn.scrollIntoViewIfNeeded()
    await innerInsertBtn.click()
    await page.waitForTimeout(1000)

    // Now there should be 2 nested question identifier inputs
    const nestedAfter = await page.locator('.conditional-block input[placeholder*="nested_field"]').count()
    expect(nestedAfter).toBe(nestedBefore + 1)

    // The NEW (empty) nested question should appear BEFORE the existing nested_${uid} question in DOM order
    const orderOk = await page.evaluate((uid: string) => {
      const nestedInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          '.conditional-block input[placeholder*="nested_field"]'
        )
      )
      // First nested input should be empty (newly inserted), second should have our identifier
      return nestedInputs.length >= 2 &&
             nestedInputs[0].value === '' &&
             nestedInputs[1].value.includes(`nested_${uid}`)
    }, uid)
    expect(orderOk).toBe(true)
  })

  // ── 4. "Add Follow-on Question" button is completely absent ────────────────
  test('"Add Follow-on Question" button does not appear anywhere in the builder', async ({ page }) => {
    const uid = Date.now().toString()
    groupId = await createGroup(page, `NoFollowOn_${uid}`)

    // Build a setup that would previously show the button:
    // Q1 + conditional + nested question
    await addQuestion(page, `q1_${uid}`, 'Question 1')
    await addConditional(page, 'yes')

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // The "Add Follow-on Question" button must not exist anywhere
    const followOnBtn = page.locator('button', { hasText: 'Add Follow-on Question' })
    expect(await followOnBtn.count()).toBe(0)
  })

  // ── 5. Nested Insert Question after 1-1-1 lands after 1-1-1, not after 1-1-2 ─
  test('Nested Insert Question after first nested item lands before second nested item', async ({ page }) => {
    const uid = Date.now().toString()
    groupId = await createGroup(page, `NestedInsert_${uid}`)

    // Q1 (saved) + conditional with two nested questions (1-1-1 and 1-1-2)
    await addQuestion(page, `q1_${uid}`, 'Question 1')
    await addConditional(page, 'yes')

    // First nested question is auto-created; fill it
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const nestedInputs = page.locator('input[placeholder*="nested_field"]')
    if (await nestedInputs.count() > 0) {
      await nestedInputs.last().fill(`nested1_${uid}`)
      await page.waitForTimeout(1500)
    }

    // Add a second nested question using the bottom-of-nested-Q Insert Question button
    // (title="Insert a nested question here")
    const nestedInsertBtn = page.locator('button[title="Insert a nested question here"]').last()
    await nestedInsertBtn.scrollIntoViewIfNeeded()
    await nestedInsertBtn.click()
    await page.waitForTimeout(1000)

    // Fill the second nested question
    const nestedInputs2 = page.locator('.conditional-block input[placeholder*="nested_field"]')
    const cnt2 = await nestedInputs2.count()
    if (cnt2 >= 2) {
      await nestedInputs2.last().fill(`nested2_${uid}`)
      await page.waitForTimeout(1500)
    }

    // Now there should be 2 nested question identifier inputs (1-1-1 and 1-1-2)
    const nestedInputsLocator = page.locator('.conditional-block input[placeholder*="nested_field"]')
    expect(await nestedInputsLocator.count()).toBe(2)

    // Click "Insert a nested question here" on the FIRST nested question (1-1-1)
    const firstNestedInsertBtn = page.locator('button[title="Insert a nested question here"]').first()
    await firstNestedInsertBtn.scrollIntoViewIfNeeded()
    await firstNestedInsertBtn.click()
    await page.waitForTimeout(1000)

    // Now there should be 3 nested question identifier inputs
    expect(await nestedInputsLocator.count()).toBe(3)

    // Order in DOM should be: nested1 → NEW (empty) → nested2
    const orderOk = await page.evaluate((uid: string) => {
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          '.conditional-block input[placeholder*="nested_field"]'
        )
      )
      if (inputs.length < 3) return false
      return inputs[0].value.includes(`nested1_${uid}`) &&
             inputs[1].value === '' &&
             inputs[2].value.includes(`nested2_${uid}`)
    }, uid)
    expect(orderOk).toBe(true)
  })

  // ── 6. Top-of-conditional Insert Conditional lands BEFORE first nested item ─
  test('Insert Conditional via top-of-conditional button lands before first nested item', async ({ page }) => {
    const uid = Date.now().toString()
    groupId = await createGroup(page, `TopInsertCond_${uid}`)

    // Q1 + conditional with nested question
    await addQuestion(page, `q1_${uid}`, 'Question 1')
    await addConditional(page, 'yes')

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const nestedInputs = page.locator('input[placeholder*="nested_field"]')
    if (await nestedInputs.count() > 0) {
      await nestedInputs.last().fill(`nested_${uid}`)
      await page.waitForTimeout(1500)
    }

    // Count nested conditional blocks before
    const nestedCondsBefore = await page.locator('.conditional-block .conditional-block').count()

    // Click "Insert a conditional inside this conditional"
    const innerCondBtn = page.locator('button[title="Insert a conditional inside this conditional"]')
    await innerCondBtn.scrollIntoViewIfNeeded()
    await innerCondBtn.click()
    await page.waitForTimeout(1000)

    // One more nested conditional block
    const nestedCondsAfter = await page.locator('.conditional-block .conditional-block').count()
    expect(nestedCondsAfter).toBe(nestedCondsBefore + 1)

    // The new nested conditional should appear BEFORE the existing nested question in the DOM.
    // (i.e., the first child element inside the outer conditional is now a conditional-block,
    //  not the original question card)
    const newCondBeforeQuestion = await page.evaluate((uid: string) => {
      const outerCond = document.querySelector('.conditional-block')
      if (!outerCond) return false

      const nestedCond = outerCond.querySelector('.conditional-block')
      const nestedQuestion = outerCond.querySelector<HTMLInputElement>(
        `input[value*="nested_${uid}"]`
      )
      if (!nestedCond || !nestedQuestion) return false
      // nestedCond should come BEFORE the nested question's input in DOM order
      return (nestedCond.compareDocumentPosition(nestedQuestion) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
    }, uid)
    expect(newCondBeforeQuestion).toBe(true)
  })
})
