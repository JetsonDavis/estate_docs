/**
 * E2E Test: Person answer persistence for non-repeatable person questions
 * inside repeatable conditional followups.
 *
 * Regression test for the bug where:
 *  - savePersonAnswer sent raw synthetic IDs to the backend (double-encoding)
 *  - seedFollowupSyntheticIds didn't distribute person answers on load
 *  - seedAllRepeatableFollowups didn't walk nested conditional followups
 *
 * Setup (via API):
 *   repeatable multiple_choice "gift_type" (options: Cash Gift, Vehicle)
 *     └─ conditional: gift_type = "Cash Gift"
 *          ├─ non-repeatable person "cash_bene" — "Who gets the cash?"
 *          └─ non-repeatable free_text "cash_amount" — "How much?"
 *
 * Test:
 *   1. Add two repeatable instances, both "Cash Gift"
 *   2. Fill person + text followups for each instance
 *   3. Reload → verify all four values survive
 */

import { test, expect, Page } from '@playwright/test'

const BASE = 'http://localhost:3005'
const API = 'http://localhost:8005/api/v1'

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

// ── Fixtures ──────────────────────────────────────────────────────────────

interface Fixture {
  groupId: number
  sessionId: number
  giftTypeId: number
  cashBeneId: number
  cashAmountId: number
}

async function createFixture(tag: string): Promise<Fixture> {
  // 1. Question group
  const group = await api('POST', '/question-groups', {
    name: `E2E_RepeatablePersonFollowup_${tag}`,
    identifier: `e2e_rpf_${tag}`,
    description: 'Auto-created by e2e test',
    display_order: 999,
  })
  const groupId = group.id

  // 2. Repeatable multiple_choice — gift type
  const giftType = await api('POST', `/question-groups/${groupId}/questions`, {
    question_group_id: groupId,
    question_text: 'What kind of gift?',
    question_type: 'multiple_choice',
    identifier: 'gift_type',
    repeatable: true,
    repeatable_group_id: crypto.randomUUID(),
    display_order: 0,
    options: [
      { value: 'Cash Gift', label: 'Cash Gift' },
      { value: 'Vehicle', label: 'Vehicle' },
    ],
  })

  // 3. Non-repeatable person followup — who gets the cash
  const cashBene = await api('POST', `/question-groups/${groupId}/questions`, {
    question_group_id: groupId,
    question_text: 'Who gets the cash?',
    question_type: 'person',
    identifier: 'cash_bene',
    repeatable: false,
    display_order: 1,
  })

  // 4. Non-repeatable free_text followup — how much
  const cashAmount = await api('POST', `/question-groups/${groupId}/questions`, {
    question_group_id: groupId,
    question_text: 'How much cash?',
    question_type: 'free_text',
    identifier: 'cash_amount',
    repeatable: false,
    display_order: 2,
  })

  // 5. Wire question_logic with conditional
  const questionLogic = [
    {
      id: crypto.randomUUID(),
      type: 'question',
      questionId: giftType.id,
      depth: 0,
      localQuestionId: crypto.randomUUID(),
    },
    {
      id: crypto.randomUUID(),
      type: 'conditional',
      depth: 0,
      conditional: {
        ifIdentifier: 'gift_type',
        value: 'Cash Gift',
        operator: 'equals',
        nestedItems: [
          {
            id: crypto.randomUUID(),
            type: 'question',
            questionId: cashBene.id,
            depth: 1,
            localQuestionId: crypto.randomUUID(),
          },
          {
            id: crypto.randomUUID(),
            type: 'question',
            questionId: cashAmount.id,
            depth: 1,
            localQuestionId: crypto.randomUUID(),
          },
        ],
      },
    },
  ]

  await api('PUT', `/question-groups/${groupId}`, { question_logic: questionLogic })

  // 6. Session
  const session = await api('POST', '/sessions/', {
    client_identifier: `E2E_RPF_${tag}`,
    starting_group_id: groupId,
  })

  return {
    groupId,
    sessionId: session.id,
    giftTypeId: giftType.id,
    cashBeneId: cashBene.id,
    cashAmountId: cashAmount.id,
  }
}

async function destroyFixture(f: Fixture): Promise<void> {
  try { await api('DELETE', `/sessions/${f.sessionId}`) } catch { /* ok */ }
  try { await api('DELETE', `/question-groups/${f.groupId}`) } catch { /* ok */ }
}

// ── Browser helpers ───────────────────────────────────────────────────────

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input#username', 'admin')
  await page.fill('input#password', 'password')
  await page.click('button[type="submit"]')
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 })
  await page.waitForTimeout(1000)
}

// ── Tests ─────────────────────────────────────────────────────────────────

test.describe('Repeatable Person Followup Persistence', () => {
  let fixture: Fixture

  test.beforeEach(async ({ page }) => {
    const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    fixture = await createFixture(tag)
    await login(page)
  })

  test.afterEach(async () => {
    await destroyFixture(fixture)
  })

  test('non-repeatable person + text followups inside repeatable parent persist across refresh', async ({ page }) => {
    test.setTimeout(120000)

    // Navigate to input form
    await page.goto(`${BASE}/document?session=${fixture.sessionId}`)
    await page.waitForSelector('text=What kind of gift?', { timeout: 15000 })
    await page.waitForTimeout(2000)

    // ── Instance 0: select "Cash Gift" ──────────────────────────────────
    const giftRadios0 = page.locator('label:has-text("Cash Gift")').first()
    await giftRadios0.click()
    await page.waitForTimeout(2000) // wait for conditional refresh

    // Verify conditional followups appeared
    await expect(page.locator('text=Who gets the cash?').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=How much cash?').first()).toBeVisible({ timeout: 10000 })

    // Fill person name for instance 0
    const personInput0 = page.locator('input[placeholder="Full name"]').first()
    await personInput0.click()
    await personInput0.fill('Alice Smith')
    await personInput0.press('Escape')
    await personInput0.blur()
    await page.waitForTimeout(2000)

    // Fill cash amount for instance 0
    const amountInput0 = page.locator('textarea').first()
    await amountInput0.fill('10000')
    await amountInput0.blur()
    await page.waitForTimeout(2000)

    // ── Add Instance 1 ──────────────────────────────────────────────────
    const addBtn = page.locator('button').filter({ hasText: /Add Another/ }).first()
    await addBtn.click()
    await page.waitForTimeout(2000)

    // Select "Cash Gift" for instance 1
    const allCashLabels = page.locator('label:has-text("Cash Gift")')
    const cashLabelCount = await allCashLabels.count()
    await allCashLabels.nth(cashLabelCount - 1).click()

    // Wait for instance 1's conditional followups to render
    await expect(page.locator('text=Who gets the cash?').nth(1)).toBeVisible({ timeout: 15000 })
    await expect(page.locator('text=How much cash?').nth(1)).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1000)

    // Verify we now have 2 person inputs
    const allPersonInputs = page.locator('input[placeholder="Full name"]')
    await expect(allPersonInputs).toHaveCount(2, { timeout: 10000 })

    // Fill person name for instance 1
    const personInput1 = allPersonInputs.nth(1)
    await personInput1.click()
    await personInput1.fill('Bob Jones')
    await personInput1.press('Escape')
    await personInput1.blur()
    await page.waitForTimeout(2000)

    // Fill cash amount for instance 1 (use the second textarea)
    const allTextareas = page.locator('textarea')
    await expect(allTextareas).toHaveCount(2, { timeout: 10000 })
    const amountInput1 = allTextareas.nth(1)
    await amountInput1.fill('50000')
    await amountInput1.blur()
    await page.waitForTimeout(3000) // extra wait for debounced saves

    // ── Verify values before refresh ────────────────────────────────────
    const preRefreshPerson0 = await page.locator('input[placeholder="Full name"]').first().inputValue()
    const preRefreshAmount0 = await page.locator('textarea').first().inputValue()
    console.log(`Before refresh — Person 0: "${preRefreshPerson0}", Amount 0: "${preRefreshAmount0}"`)

    const preRefreshPerson1 = await page.locator('input[placeholder="Full name"]').nth(1).inputValue()
    const preRefreshAmount1 = await page.locator('textarea').nth(1).inputValue()
    console.log(`Before refresh — Person 1: "${preRefreshPerson1}", Amount 1: "${preRefreshAmount1}"`)

    expect(preRefreshPerson0).toBe('Alice Smith')
    expect(preRefreshAmount0).toBe('10000')
    expect(preRefreshPerson1).toBe('Bob Jones')
    expect(preRefreshAmount1).toBe('50000')

    // ── Reload ──────────────────────────────────────────────────────────
    await page.reload()
    await page.waitForSelector('text=What kind of gift?', { timeout: 15000 })
    await page.waitForTimeout(3000)

    // ── Verify values after refresh ─────────────────────────────────────
    // Both "Cash Gift" conditionals should still be visible
    await expect(page.locator('text=Who gets the cash?').first()).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=How much cash?').first()).toBeVisible({ timeout: 10000 })

    // Wait for both person inputs to render
    const postPersonInputs = page.locator('input[placeholder="Full name"]')
    await expect(postPersonInputs).toHaveCount(2, { timeout: 10000 })

    const postPerson0 = await postPersonInputs.first().inputValue()
    const postPerson1 = await postPersonInputs.nth(1).inputValue()
    console.log(`After refresh — Person 0: "${postPerson0}", Person 1: "${postPerson1}"`)

    expect(postPerson0).toBe('Alice Smith')
    expect(postPerson1).toBe('Bob Jones')

    // Wait for both text inputs to render
    const postTextareas = page.locator('textarea')
    await expect(postTextareas).toHaveCount(2, { timeout: 10000 })

    const postAmount0 = await postTextareas.first().inputValue()
    const postAmount1 = await postTextareas.nth(1).inputValue()
    console.log(`After refresh — Amount 0: "${postAmount0}", Amount 1: "${postAmount1}"`)

    expect(postAmount0).toBe('10000')
    expect(postAmount1).toBe('50000')

    console.log('✅ All person + text followup values persisted across refresh')
  })

  test('person followup value should not bleed between instances', async ({ page }) => {
    test.setTimeout(120000)

    await page.goto(`${BASE}/document?session=${fixture.sessionId}`)
    await page.waitForSelector('text=What kind of gift?', { timeout: 15000 })
    await page.waitForTimeout(2000)

    // Instance 0: Cash Gift with person
    const cashLabel0 = page.locator('label:has-text("Cash Gift")').first()
    await cashLabel0.click()

    // Wait for conditional followup to render
    await expect(page.locator('text=Who gets the cash?').first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    const personInput0 = page.locator('input[placeholder="Full name"]').first()
    await personInput0.fill('Only In Instance Zero')
    await personInput0.press('Escape')
    await personInput0.blur()
    await page.waitForTimeout(3000) // wait for debounced save

    // Add instance 1: Vehicle (no cash followup)
    const addBtn = page.locator('button').filter({ hasText: /Add Another/ }).first()
    await addBtn.click()
    await page.waitForTimeout(2000)

    // Select Vehicle for instance 1
    const allVehicleLabels = page.locator('label:has-text("Vehicle")')
    const vehicleCount = await allVehicleLabels.count()
    await allVehicleLabels.nth(vehicleCount - 1).click()
    await page.waitForTimeout(5000) // wait for conditional refresh

    // After selecting Vehicle for instance 1, there should still be exactly 1 person input
    const personInputCount = await page.locator('input[placeholder="Full name"]').count()
    expect(personInputCount).toBe(1)

    // Verify instance 0's person value wasn't cleared by instance 1's conditional refresh
    const prePerson0 = await page.locator('input[placeholder="Full name"]').first().inputValue()
    console.log(`Before refresh — Person 0: "${prePerson0}"`)
    expect(prePerson0).toBe('Only In Instance Zero')

    // Reload
    await page.reload()
    await page.waitForSelector('text=What kind of gift?', { timeout: 15000 })
    await page.waitForTimeout(3000)

    // Wait for conditional followup to render after reload
    await expect(page.locator('text=Who gets the cash?').first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(1000)

    // Instance 0 person should still be "Only In Instance Zero"
    const postPerson0 = await page.locator('input[placeholder="Full name"]').first().inputValue()
    console.log(`After refresh — Person 0: "${postPerson0}"`)
    expect(postPerson0).toBe('Only In Instance Zero')

    // Should still be only 1 person input (Vehicle instance has no cash followup)
    const postPersonCount = await page.locator('input[placeholder="Full name"]').count()
    expect(postPersonCount).toBe(1)

    console.log('✅ Person value did not bleed between instances')
  })
})
