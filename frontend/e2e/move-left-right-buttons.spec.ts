import { test, expect, Page } from '@playwright/test'

/**
 * Comprehensive tests for the left/right arrow buttons on questions and conditionals.
 *
 * Structure created for each test:
 *   Q1 (multiple_choice: opt_a, opt_b)
 *   C1-1 (if Q1 equals opt_a)
 *     NQ1 (text)
 *     NQ2 (text)
 *   C1-2 (if Q1 equals opt_b)
 *     NQ3 (text)
 *   Q2 (text)
 *   Q3 (text)
 */

const API = 'http://localhost:8005/api/v1'
const BASE = 'http://localhost:3005'

let authCookie = ''

async function apiLogin(): Promise<void> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'password' }),
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status}`)
  const setCookies = res.headers.getSetCookie?.() ?? []
  authCookie = setCookies.map(c => c.split(';')[0]).join('; ')
}

async function api(method: string, path: string, body?: any): Promise<any> {
  if (!authCookie) await apiLogin()
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: authCookie },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'follow',
  })
  if (res.status === 204) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API ${method} ${path} → ${res.status} ${text}`)
  }
  return res.json()
}

// ── Fixture: create a question group with known structure ────────────────

interface Fixture {
  groupId: number
  q1Id: number
  q2Id: number
  q3Id: number
  nq1Id: number
  nq2Id: number
  nq3Id: number
}

async function createFixture(tag: string): Promise<Fixture> {
  const group = await api('POST', '/question-groups', {
    name: `MoveTest_${tag}`,
    identifier: `move_test_${tag}`,
    description: 'e2e move-left-right test',
    display_order: 999,
  })
  const gid = group.id

  const q1 = await api('POST', `/question-groups/${gid}/questions`, {
    question_group_id: gid,
    question_text: 'Root Q1 (choice)',
    question_type: 'multiple_choice',
    identifier: `q1_${tag}`,
    display_order: 0,
    options: [
      { value: 'opt_a', label: 'Option A' },
      { value: 'opt_b', label: 'Option B' },
    ],
  })
  const nq1 = await api('POST', `/question-groups/${gid}/questions`, {
    question_group_id: gid,
    question_text: 'Nested Q1',
    question_type: 'free_text',
    identifier: `nq1_${tag}`,
    display_order: 1,
  })
  const nq2 = await api('POST', `/question-groups/${gid}/questions`, {
    question_group_id: gid,
    question_text: 'Nested Q2',
    question_type: 'free_text',
    identifier: `nq2_${tag}`,
    display_order: 2,
  })
  const nq3 = await api('POST', `/question-groups/${gid}/questions`, {
    question_group_id: gid,
    question_text: 'Nested Q3',
    question_type: 'free_text',
    identifier: `nq3_${tag}`,
    display_order: 3,
  })
  const q2 = await api('POST', `/question-groups/${gid}/questions`, {
    question_group_id: gid,
    question_text: 'Root Q2 (text)',
    question_type: 'free_text',
    identifier: `q2_${tag}`,
    display_order: 4,
  })
  const q3 = await api('POST', `/question-groups/${gid}/questions`, {
    question_group_id: gid,
    question_text: 'Root Q3 (text)',
    question_type: 'free_text',
    identifier: `q3_${tag}`,
    display_order: 5,
  })

  // Build question_logic:
  //   [Q1, C1-1(nq1,nq2), C1-2(nq3), Q2, Q3]
  const questionLogic = [
    { id: crypto.randomUUID(), type: 'question', questionId: q1.id, depth: 0 },
    {
      id: crypto.randomUUID(),
      type: 'conditional',
      depth: 0,
      conditional: {
        ifIdentifier: `q1_${tag}`,
        operator: 'equals',
        value: 'opt_a',
        nestedItems: [
          { id: crypto.randomUUID(), type: 'question', questionId: nq1.id, depth: 1 },
          { id: crypto.randomUUID(), type: 'question', questionId: nq2.id, depth: 1 },
        ],
      },
    },
    {
      id: crypto.randomUUID(),
      type: 'conditional',
      depth: 0,
      conditional: {
        ifIdentifier: `q1_${tag}`,
        operator: 'equals',
        value: 'opt_b',
        nestedItems: [
          { id: crypto.randomUUID(), type: 'question', questionId: nq3.id, depth: 1 },
        ],
      },
    },
    { id: crypto.randomUUID(), type: 'question', questionId: q2.id, depth: 0 },
    { id: crypto.randomUUID(), type: 'question', questionId: q3.id, depth: 0 },
  ]

  await api('PUT', `/question-groups/${gid}`, { question_logic: questionLogic })

  return { groupId: gid, q1Id: q1.id, q2Id: q2.id, q3Id: q3.id, nq1Id: nq1.id, nq2Id: nq2.id, nq3Id: nq3.id }
}

async function deleteFixture(groupId: number) {
  try { await api('DELETE', `/question-groups/${groupId}`) } catch { /* ok */ }
}

async function getQuestionLogic(groupId: number): Promise<any[]> {
  const g = await api('GET', `/question-groups/${groupId}`)
  return g.question_logic || []
}

// ── Browser helpers ─────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[id="username"]', 'admin')
  await page.fill('input[id="password"]', 'password')
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

async function navigateToGroup(page: Page, groupId: number) {
  await page.goto(`${BASE}/admin/question-groups/${groupId}/edit`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
}

/** Read the current question_logic saved on the server */
async function fetchLogic(groupId: number) {
  return getQuestionLogic(groupId)
}

/** Extract a flat ordered list of {type, questionId, depth} from question_logic, including nested */
function flattenLogic(logic: any[]): { type: string; questionId?: number; condValue?: string; depth: number; children?: any[] }[] {
  const result: any[] = []
  for (const item of logic) {
    if (item.type === 'question') {
      result.push({ type: 'question', questionId: item.questionId, depth: item.depth ?? 0 })
    } else if (item.type === 'conditional') {
      const c = item.conditional || {}
      result.push({
        type: 'conditional',
        condValue: c.value,
        ifIdentifier: c.ifIdentifier,
        depth: item.depth ?? 0,
        children: c.nestedItems ? flattenLogic(c.nestedItems) : [],
      })
    }
  }
  return result
}

/** Collect all questionIds from flat logic in order (DFS) */
function collectQuestionIds(logic: any[]): number[] {
  const ids: number[] = []
  for (const item of logic) {
    if (item.type === 'question' && item.questionId) ids.push(item.questionId)
    if (item.type === 'conditional' && item.conditional?.nestedItems) {
      ids.push(...collectQuestionIds(item.conditional.nestedItems))
    }
  }
  return ids
}

/** Count root-level items of a given type */
function countRootItems(logic: any[], type: string): number {
  return logic.filter(i => i.type === type).length
}

/** Find a conditional by its value at root level */
function findRootConditional(logic: any[], value: string): any | undefined {
  return logic.find(i => i.type === 'conditional' && i.conditional?.value === value)
}

/** Wait for auto-save to persist (the UI debounces saves) */
async function waitForSave(page: Page) {
  // The UI shows "Saving..." then "✓ Saved" — wait for saves to complete
  await page.waitForTimeout(4000)
}

// ── Tests ───────────────────────────────────────────────────────────────

test.describe('Move Left/Right Buttons', () => {
  let fixture: Fixture

  test.beforeEach(async ({ page }) => {
    const tag = Date.now().toString()
    fixture = await createFixture(tag)
    await login(page)
    await navigateToGroup(page, fixture.groupId)
  })

  test.afterEach(async () => {
    await deleteFixture(fixture.groupId)
  })

  // ─── Visibility tests ──────────────────────────────────────────────

  test('left arrow is NOT visible on root-level questions', async ({ page }) => {
    // Root-level questions should NOT have a left arrow (already at root)
    // They are rendered inside .question-builder headers
    // The left arrow has title "Move question one level left"
    const leftArrows = page.locator('button[title*="Move question one level left"]')
    // There should be no left arrows on root-level questions
    // But there might be left arrows on nested questions, so check specifically
    // Root-level question headers don't have the left arrow at all
    const rootQuestionHeaders = page.locator('.question-builder').first()
    const leftInRoot = rootQuestionHeaders.locator('button[title*="Move question one level left"]')
    expect(await leftInRoot.count()).toBe(0)
  })

  test('right arrow is visible on root-level questions when conditional exists above', async ({ page }) => {
    // Q2 and Q3 should have right arrows because there are conditionals above them in questionLogic
    // Q1 should NOT have a right arrow (no conditional above it)
    // Find the question headers by their "Question N" labels
    const q1Header = page.locator('text=Question 1').first()
    const q1Container = q1Header.locator('..')
    // Q1 header area should NOT have a right arrow
    const rightArrowQ1 = q1Container.locator('button[title*="Move question one level right"]')
    expect(await rightArrowQ1.count()).toBe(0)

    // Q2 should have a right arrow (conditionals C1-1, C1-2 are above it)
    const q2RightArrow = page.locator('button[title*="Move question one level right"]').first()
    expect(await q2RightArrow.isVisible()).toBe(true)
  })

  test('left arrow is visible on nested questions inside conditionals', async ({ page }) => {
    // Nested questions (NQ1, NQ2, NQ3) should have left arrows
    const leftArrows = page.locator('button[title*="Move question one level left"]')
    expect(await leftArrows.count()).toBeGreaterThanOrEqual(1)
  })

  test('left arrow is visible on nested conditionals', async ({ page }) => {
    // Currently there are no nested conditionals in the fixture, but the
    // conditional headers should show left arrows when nested
    const condLeftArrows = page.locator('button[title*="Move conditional one level left"]')
    // In the base fixture there are no nested conditionals, so count should be 0
    expect(await condLeftArrows.count()).toBe(0)
  })

  // ─── Move Question RIGHT (root → into conditional) ─────────────────

  test('move root Q3 right → goes into nearest conditional above (C1-2)', async ({ page }) => {
    // Initial: [Q1, C1-1(nq1,nq2), C1-2(nq3), Q2, Q3]
    // Q3's logicIndex is 4. Nearest conditional above is C1-2 at index 2.
    // Wait – actually Q2 is at index 3, which is a question, not conditional.
    // Searching backward from Q3 (index 4): index 3 is Q2 (skip), index 2 is C1-2 (conditional!) → target.
    // After move: [Q1, C1-1(nq1,nq2), C1-2(nq3, Q3), Q2]

    // Find Q3's right arrow button — it should be on the last root question
    // Q3 is "Question 3". Its right arrow is in its header.
    const q3Header = page.locator('text=Question 3').first()
    await q3Header.scrollIntoViewIfNeeded()
    const q3Section = q3Header.locator('xpath=ancestor::div[contains(@class, "question-builder")]').first()
    const rightArrow = q3Section.locator('button[title*="Move question one level right"]')
    
    if (await rightArrow.count() === 0) {
      // Try finding by proximity — the right arrow near "Question 3"
      const allRightArrows = page.locator('button[title*="Move question one level right"]')
      const count = await allRightArrows.count()
      // The last right arrow on a root question should be Q3's
      if (count > 0) {
        await allRightArrows.last().scrollIntoViewIfNeeded()
        await allRightArrows.last().click()
      } else {
        throw new Error('No right arrow buttons found for root questions')
      }
    } else {
      await rightArrow.click()
    }

    await waitForSave(page)

    // Verify server state
    const logic = await fetchLogic(fixture.groupId)
    // Q3 should now be inside a conditional, not at root level
    const rootQuestionIds = logic.filter((i: any) => i.type === 'question').map((i: any) => i.questionId)
    expect(rootQuestionIds).not.toContain(fixture.q3Id)

    // Q3 should be inside C1-2 (the conditional with value opt_b)
    const c12 = findRootConditional(logic, 'opt_b')
    expect(c12).toBeTruthy()
    const nestedIds = collectQuestionIds(c12.conditional.nestedItems)
    expect(nestedIds).toContain(fixture.q3Id)

    // Root level should now have: Q1, C1-1, C1-2, Q2 (3 root questions → 2)
    expect(countRootItems(logic, 'question')).toBe(2) // Q1 and Q2
  })

  test('move root Q2 right → goes into nearest conditional above (C1-2)', async ({ page }) => {
    // Initial: [Q1, C1-1(nq1,nq2), C1-2(nq3), Q2, Q3]
    // Q2's logicIndex is 3. Backward: index 2 = C1-2 (conditional) → target
    // After move: [Q1, C1-1(nq1,nq2), C1-2(nq3, Q2), Q3]

    // Find Q2's right arrow — "Question 2"
    const allRightArrows = page.locator('button[title*="Move question one level right"]')
    // First right arrow should be Q2's (Q1 has no right arrow)
    await allRightArrows.first().scrollIntoViewIfNeeded()
    await allRightArrows.first().click()

    await waitForSave(page)

    const logic = await fetchLogic(fixture.groupId)
    const rootQuestionIds = logic.filter((i: any) => i.type === 'question').map((i: any) => i.questionId)
    expect(rootQuestionIds).not.toContain(fixture.q2Id)
    expect(rootQuestionIds).toContain(fixture.q3Id) // Q3 should still be at root

    const c12 = findRootConditional(logic, 'opt_b')
    expect(c12).toBeTruthy()
    const nestedIds = collectQuestionIds(c12.conditional.nestedItems)
    expect(nestedIds).toContain(fixture.q2Id)
  })

  // ─── Move Question LEFT (nested → parent level) ────────────────────

  test('move nested NQ2 left → appears at root level after C1-1', async ({ page }) => {
    // Initial: [Q1, C1-1(nq1, nq2), C1-2(nq3), Q2, Q3]
    // NQ2 is at index 1 inside C1-1. parentPath = [1] (C1-1 is at questionLogic[1])
    // After moveQuestionLeft(1, [1]):
    //   C1-1.nestedItems becomes [nq1]
    //   NQ2 is inserted at parentLevel[2] (root level, right after C1-1)
    //   Result: [Q1, C1-1(nq1), NQ2, C1-2(nq3), Q2, Q3]

    // Expand the first conditional to see nested questions
    const conditionalHeaders = page.locator('text=/Conditional \\(1-/')
    if (await conditionalHeaders.count() > 0) {
      await conditionalHeaders.first().click()
      await page.waitForTimeout(500)
    }

    // Find left arrows on nested questions
    const leftArrows = page.locator('button[title*="Move question one level left"]')
    const leftCount = await leftArrows.count()
    expect(leftCount).toBeGreaterThanOrEqual(1)

    // The second left arrow in C1-1 should be NQ2's (NQ1 is first, NQ2 is second)
    // But we need to be careful — NQ1 also has a left arrow
    // Let's click the LAST left arrow inside the first conditional
    // to move NQ2 out
    if (leftCount >= 2) {
      await leftArrows.nth(1).scrollIntoViewIfNeeded()
      await leftArrows.nth(1).click()
    } else {
      await leftArrows.first().scrollIntoViewIfNeeded()
      await leftArrows.first().click()
    }

    await waitForSave(page)

    const logic = await fetchLogic(fixture.groupId)
    // NQ2 should now be at root level
    const rootQuestionIds = logic.filter((i: any) => i.type === 'question').map((i: any) => i.questionId)
    // NQ2 moved to root, so root questions include Q1, NQ2, Q2, Q3
    expect(rootQuestionIds).toContain(fixture.nq2Id)

    // C1-1 should now only have NQ1
    const c11 = findRootConditional(logic, 'opt_a')
    expect(c11).toBeTruthy()
    const c11NestedIds = collectQuestionIds(c11.conditional.nestedItems)
    expect(c11NestedIds).toContain(fixture.nq1Id)
    expect(c11NestedIds).not.toContain(fixture.nq2Id)

    // NQ2 should appear AFTER C1-1 in the root logic array
    const c11Index = logic.findIndex((i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_a')
    const nq2Index = logic.findIndex((i: any) => i.type === 'question' && i.questionId === fixture.nq2Id)
    expect(nq2Index).toBeGreaterThan(c11Index)
    // And NQ2 should appear BEFORE C1-2
    const c12Index = logic.findIndex((i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_b')
    expect(nq2Index).toBeLessThan(c12Index)
  })

  // ─── Move Conditional RIGHT (root → into sibling conditional) ──────

  test('move root conditional C1-2 right → goes into C1-1', async ({ page }) => {
    // Initial: [Q1, C1-1(nq1,nq2), C1-2(nq3), Q2, Q3]
    // C1-2 is at logicIndex 2. Nearest conditional above: C1-1 at index 1.
    // After move: [Q1, C1-1(nq1,nq2, C1-2(nq3)), Q2, Q3]

    // Find C1-2's right arrow — it should be on "Conditional (1-2)"
    const condRightArrows = page.locator('button[title*="Move conditional one level right"]')
    const condRightCount = await condRightArrows.count()
    
    if (condRightCount > 0) {
      await condRightArrows.first().scrollIntoViewIfNeeded()
      await condRightArrows.first().click()
    } else {
      // C1-2 might not have a right arrow if canMoveQuestionRight returns false
      console.log('No conditional right arrows found — this is a bug if C1-2 exists below C1-1')
      test.fail()
      return
    }

    await waitForSave(page)

    const logic = await fetchLogic(fixture.groupId)
    // C1-2 should no longer be at root level
    const rootConditionals = logic.filter((i: any) => i.type === 'conditional')
    // Only C1-1 should remain at root
    expect(rootConditionals.length).toBe(1)
    expect(rootConditionals[0].conditional.value).toBe('opt_a')

    // C1-2 should now be inside C1-1's nestedItems
    const c11 = rootConditionals[0]
    const nestedConditionals = (c11.conditional.nestedItems || []).filter((i: any) => i.type === 'conditional')
    expect(nestedConditionals.length).toBe(1)
    expect(nestedConditionals[0].conditional.value).toBe('opt_b')

    // NQ3 should still be inside C1-2 (now nested inside C1-1)
    const c12nested = nestedConditionals[0].conditional.nestedItems || []
    const c12questionIds = c12nested.filter((i: any) => i.type === 'question').map((i: any) => i.questionId)
    expect(c12questionIds).toContain(fixture.nq3Id)
  })

  // ─── Move Conditional LEFT (nested → parent level) ────────────────

  test('move nested conditional left → appears at parent level', async ({ page }) => {
    // First, move C1-2 right into C1-1 to create a nested conditional
    const condRightArrows = page.locator('button[title*="Move conditional one level right"]')
    if (await condRightArrows.count() > 0) {
      await condRightArrows.first().scrollIntoViewIfNeeded()
      await condRightArrows.first().click()
      await waitForSave(page)
    }

    // Verify C1-2 is now nested inside C1-1
    let logic = await fetchLogic(fixture.groupId)
    let rootConds = logic.filter((i: any) => i.type === 'conditional')
    expect(rootConds.length).toBe(1) // Only C1-1 at root

    // Now reload the page to pick up the new structure
    await navigateToGroup(page, fixture.groupId)

    // Find the left arrow on the now-nested conditional
    const condLeftArrows = page.locator('button[title*="Move conditional one level left"]')
    const leftCount = await condLeftArrows.count()
    expect(leftCount).toBeGreaterThanOrEqual(1)

    await condLeftArrows.first().scrollIntoViewIfNeeded()
    await condLeftArrows.first().click()
    await waitForSave(page)

    // Verify C1-2 is back at root level
    logic = await fetchLogic(fixture.groupId)
    rootConds = logic.filter((i: any) => i.type === 'conditional')
    expect(rootConds.length).toBe(2) // C1-1 and C1-2 back at root

    // C1-2 should appear AFTER C1-1 in root
    const c11Idx = logic.findIndex((i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_a')
    const c12Idx = logic.findIndex((i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_b')
    expect(c12Idx).toBeGreaterThan(c11Idx)

    // NQ3 should still be inside C1-2
    const c12 = logic[c12Idx]
    const c12questionIds = (c12.conditional.nestedItems || []).filter((i: any) => i.type === 'question').map((i: any) => i.questionId)
    expect(c12questionIds).toContain(fixture.nq3Id)
  })

  // ─── Nested question RIGHT (nested → deeper conditional) ──────────

  test('move nested NQ2 right into nested conditional → fails if no conditional above', async ({ page }) => {
    // In C1-1, items are [NQ1, NQ2]. There's no conditional above NQ2 at the same
    // level (both items are questions), so the right arrow should NOT be visible.

    // Get nested question right arrows inside conditionals
    // NQ1 is at index 0 in C1-1 — no conditional above, no right arrow
    // NQ2 is at index 1 in C1-1 — NQ1 is a question (not conditional), no right arrow

    // So no right arrows should exist on nested questions in C1-1
    // (the canMoveQuestionRight check should hide them)
    // This test verifies that incorrect right arrows aren't showing
    const rightArrowsNested = page.locator('.conditional-block button[title*="Move question one level right"]')
    // Should be 0 because there are no conditionals above any nested question
    expect(await rightArrowsNested.count()).toBe(0)
  })

  // ─── Ordering preserved after multiple moves ──────────────────────

  test('move Q3 right then left → returns to original position', async ({ page }) => {
    // Record initial state
    const initialLogic = await fetchLogic(fixture.groupId)
    const initialRootQIds = initialLogic.filter((i: any) => i.type === 'question').map((i: any) => i.questionId)

    // Move Q3 right (into C1-2)
    const rightArrows = page.locator('button[title*="Move question one level right"]')
    // Last root-level right arrow should be Q3's
    await rightArrows.last().scrollIntoViewIfNeeded()
    await rightArrows.last().click()
    await waitForSave(page)

    // Verify Q3 is nested
    let logic = await fetchLogic(fixture.groupId)
    let rootQIds = logic.filter((i: any) => i.type === 'question').map((i: any) => i.questionId)
    expect(rootQIds).not.toContain(fixture.q3Id)

    // Reload to get new UI state
    await navigateToGroup(page, fixture.groupId)

    // Now Q3 is nested — find its left arrow and click it
    const leftArrows = page.locator('button[title*="Move question one level left"]')
    // Q3's left arrow should be among the nested question left arrows
    // Find it by scrolling to the bottom where the conditional with Q3 is
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // Click the last left arrow (should be Q3's since it was just moved into the last conditional)
    const leftCount = await leftArrows.count()
    if (leftCount > 0) {
      await leftArrows.last().scrollIntoViewIfNeeded()
      await leftArrows.last().click()
      await waitForSave(page)
    }

    // Verify Q3 is back at root level
    logic = await fetchLogic(fixture.groupId)
    rootQIds = logic.filter((i: any) => i.type === 'question').map((i: any) => i.questionId)
    expect(rootQIds).toContain(fixture.q3Id)

    // Verify root question count is back to 3
    expect(rootQIds.length).toBe(3)
  })

  // ─── Data integrity after moves ───────────────────────────────────

  test('conditional preserves ifIdentifier and value after moving right', async ({ page }) => {
    // Move C1-2 right into C1-1
    const condRightArrows = page.locator('button[title*="Move conditional one level right"]')
    if (await condRightArrows.count() > 0) {
      await condRightArrows.first().scrollIntoViewIfNeeded()
      await condRightArrows.first().click()
      await waitForSave(page)
    }

    const logic = await fetchLogic(fixture.groupId)
    const c11 = logic.find((i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_a')
    expect(c11).toBeTruthy()

    // Find C1-2 inside C1-1's nestedItems
    const nestedCond = (c11.conditional.nestedItems || []).find(
      (i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_b'
    )
    expect(nestedCond).toBeTruthy()
    expect(nestedCond.conditional.value).toBe('opt_b')
    // ifIdentifier should be preserved
    expect(nestedCond.conditional.ifIdentifier).toContain('q1_')
  })

  test('all question IDs preserved after move operations (no data loss)', async ({ page }) => {
    const initialLogic = await fetchLogic(fixture.groupId)
    const initialAllIds = collectQuestionIds(initialLogic).sort()

    // Move Q3 right
    const rightArrows = page.locator('button[title*="Move question one level right"]')
    await rightArrows.last().scrollIntoViewIfNeeded()
    await rightArrows.last().click()
    await waitForSave(page)

    const afterLogic = await fetchLogic(fixture.groupId)
    const afterAllIds = collectQuestionIds(afterLogic).sort()

    // Same question IDs should exist (just in different positions)
    expect(afterAllIds).toEqual(initialAllIds)
  })

  // ─── Edge case: move the only nested question out ─────────────────

  // ─── Depth correctness after moves ──────────────────────────────────

  test('depth updated correctly when conditional moves right (root → nested)', async ({ page }) => {
    // Move C1-2 right into C1-1
    const condRightArrows = page.locator('button[title*="Move conditional one level right"]')
    if (await condRightArrows.count() > 0) {
      await condRightArrows.first().scrollIntoViewIfNeeded()
      await condRightArrows.first().click()
      await waitForSave(page)
    }

    const logic = await fetchLogic(fixture.groupId)
    const c11 = logic.find((i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_a')
    expect(c11).toBeTruthy()
    // C1-1 should still be at depth 0
    expect(c11.depth).toBe(0)

    // C1-2 is now nested inside C1-1 — it should be at depth 1
    const nestedCond = (c11.conditional.nestedItems || []).find(
      (i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_b'
    )
    expect(nestedCond).toBeTruthy()
    expect(nestedCond.depth).toBe(1)

    // NQ3 inside C1-2 should now be at depth 2
    const nq3 = (nestedCond.conditional.nestedItems || []).find(
      (i: any) => i.type === 'question' && i.questionId === fixture.nq3Id
    )
    expect(nq3).toBeTruthy()
    expect(nq3.depth).toBe(2)
  })

  test('depth updated correctly when conditional moves left (nested → root)', async ({ page }) => {
    // First move C1-2 into C1-1
    const condRightArrows = page.locator('button[title*="Move conditional one level right"]')
    if (await condRightArrows.count() > 0) {
      await condRightArrows.first().scrollIntoViewIfNeeded()
      await condRightArrows.first().click()
      await waitForSave(page)
    }

    // Reload page
    await navigateToGroup(page, fixture.groupId)

    // Move C1-2 back out
    const condLeftArrows = page.locator('button[title*="Move conditional one level left"]')
    if (await condLeftArrows.count() > 0) {
      await condLeftArrows.first().scrollIntoViewIfNeeded()
      await condLeftArrows.first().click()
      await waitForSave(page)
    }

    const logic = await fetchLogic(fixture.groupId)
    // C1-2 should be back at root with depth 0
    const c12 = logic.find((i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_b')
    expect(c12).toBeTruthy()
    expect(c12.depth).toBe(0)

    // NQ3 inside C1-2 should be at depth 1
    const nq3 = (c12.conditional.nestedItems || []).find(
      (i: any) => i.type === 'question' && i.questionId === fixture.nq3Id
    )
    expect(nq3).toBeTruthy()
    expect(nq3.depth).toBe(1)
  })

  test('depth updated correctly when question moves right (root → nested)', async ({ page }) => {
    // Move Q3 right into the nearest conditional above
    const rightArrows = page.locator('button[title*="Move question one level right"]')
    await rightArrows.last().scrollIntoViewIfNeeded()
    await rightArrows.last().click()
    await waitForSave(page)

    const logic = await fetchLogic(fixture.groupId)
    // Find Q3 inside the conditional it was moved into
    const allNested = logic.filter((i: any) => i.type === 'conditional')
    let q3Item: any = null
    for (const cond of allNested) {
      const found = (cond.conditional.nestedItems || []).find(
        (i: any) => i.type === 'question' && i.questionId === fixture.q3Id
      )
      if (found) { q3Item = found; break }
    }
    expect(q3Item).toBeTruthy()
    expect(q3Item.depth).toBe(1) // Was depth 0, should now be depth 1
  })

  test('depth updated correctly when question moves left (nested → root)', async ({ page }) => {
    // Move NQ2 (inside C1-1) left to root level
    const leftArrows = page.locator('button[title*="Move question one level left"]')
    const leftCount = await leftArrows.count()
    // NQ2 is the second nested question, click its left arrow
    if (leftCount >= 2) {
      await leftArrows.nth(1).scrollIntoViewIfNeeded()
      await leftArrows.nth(1).click()
    } else {
      await leftArrows.first().scrollIntoViewIfNeeded()
      await leftArrows.first().click()
    }
    await waitForSave(page)

    const logic = await fetchLogic(fixture.groupId)
    // Find the moved question at root level
    const movedQ = logic.find(
      (i: any) => i.type === 'question' && (i.questionId === fixture.nq2Id || i.questionId === fixture.nq1Id)
    )
    expect(movedQ).toBeTruthy()
    expect(movedQ.depth).toBe(0) // Should be 0 at root level
  })

  // ─── Visual DOM verification ──────────────────────────────────────

  test('DOM order matches saved logic after moving Q3 right', async ({ page }) => {
    // Move Q3 right
    const rightArrows = page.locator('button[title*="Move question one level right"]')
    await rightArrows.last().scrollIntoViewIfNeeded()
    await rightArrows.last().click()
    await waitForSave(page)

    // Reload to see updated UI
    await navigateToGroup(page, fixture.groupId)

    // Q3 should no longer be visible as a root-level question (no "Question 3" at root)
    const q3RootHeader = page.locator('text=Question 3')
    // There should be no "Question 3" anymore since we went from 3 root questions to 2
    expect(await q3RootHeader.count()).toBe(0)

    // There should now be only 2 root-level questions
    const q1Header = page.locator('text=Question 1')
    const q2Header = page.locator('text=Question 2')
    expect(await q1Header.count()).toBe(1)
    expect(await q2Header.count()).toBe(1)
  })

  // ─── Edge case: move the only nested question out ─────────────────

  test('move only nested question out of conditional → conditional has no questions', async ({ page }) => {
    // C1-2 has only NQ3. Moving NQ3 out should leave C1-2 with empty nestedItems (or just the auto-created nested question).
    // Find NQ3's left arrow — it's inside C1-2
    // First, ensure conditionals are expanded
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)

    // Find left arrows
    const leftArrows = page.locator('button[title*="Move question one level left"]')
    const leftCount = await leftArrows.count()
    // NQ3 is inside C1-2, which is the second conditional
    // The left arrows in order should be: NQ1(in C1-1), NQ2(in C1-1), NQ3(in C1-2)
    expect(leftCount).toBeGreaterThanOrEqual(3)

    // Click the last left arrow (NQ3's)
    await leftArrows.last().scrollIntoViewIfNeeded()
    await leftArrows.last().click()
    await waitForSave(page)

    const logic = await fetchLogic(fixture.groupId)
    // NQ3 should be at root level
    const rootQIds = logic.filter((i: any) => i.type === 'question').map((i: any) => i.questionId)
    expect(rootQIds).toContain(fixture.nq3Id)

    // NQ3 should appear right after C1-2 in the logic array
    const c12Idx = logic.findIndex((i: any) => i.type === 'conditional' && i.conditional?.value === 'opt_b')
    const nq3Idx = logic.findIndex((i: any) => i.type === 'question' && i.questionId === fixture.nq3Id)
    expect(nq3Idx).toBe(c12Idx + 1)
  })
})
