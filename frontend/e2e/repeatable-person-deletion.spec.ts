/**
 * E2E Tests for Repeatable Person Input Deletion
 *
 * Focused test suite using only Person type (which we know works)
 * to verify deletion bugs, especially middle instance deletion.
 */

import { test, expect, Page } from '@playwright/test'

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3005',
  backendUrl: 'http://localhost:8005',
}

let createdGroupIds: number[] = []
let createdSessionIds: number[] = []

async function login(page: Page) {
  await page.goto(`${TEST_CONFIG.baseUrl}/login`)
  await page.fill('input[id="username"]', 'admin')
  await page.fill('input[id="password"]', 'password')
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
}

async function createQuestionGroupWithPersonQuestion(page: Page, uniqueId: string): Promise<number> {
  await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`)
  await page.waitForLoadState('networkidle')
  await page.click('text=Create Questions Group')
  await page.waitForTimeout(1000)

  const nameInput = page.locator('input.form-input').first()
  await nameInput.waitFor({ state: 'visible', timeout: 10000 })
  await nameInput.fill(`E2E_PersonDelete_${uniqueId}`)
  await page.waitForTimeout(500)

  const checkingName = page.getByText('Checking name...')
  if (await checkingName.isVisible().catch(() => false)) {
    await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined)
  }
  await page.waitForTimeout(1000)

  await page.click('text=Save Group Information')
  await page.waitForSelector('text=Questions', { timeout: 10000 })
  await page.waitForTimeout(1000)

  const url = page.url()
  const match = url.match(/\/question-groups\/(\d+)/)
  const groupId = match ? parseInt(match[1], 10) : 0
  if (groupId) createdGroupIds.push(groupId)

  // Add a person-type question
  const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.click()
  await page.waitForTimeout(1000)

  const identifierInput = page.locator('input[placeholder*="full_name"]').first()
  await identifierInput.fill(`people_${uniqueId}`)
  await page.waitForTimeout(500)

  const questionTextarea = page.locator('.question-builder textarea').first()
  await questionTextarea.fill('List the people')
  await page.waitForTimeout(500)

  // Select "Person" answer type
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const personRadio = page.locator('text=Person').first()
  await personRadio.click()
  await page.waitForTimeout(1000)

  // Check "Repeatable"
  const repeatableCheckbox = page.locator('input[type="checkbox"]').first()
  await repeatableCheckbox.scrollIntoViewIfNeeded()
  const isChecked = await repeatableCheckbox.isChecked()
  if (!isChecked) {
    await repeatableCheckbox.click()
    await page.waitForTimeout(1000)
  }

  // Wait for auto-save to complete so repeatable flag is persisted
  await page.waitForSelector('text=✓ Saved', { timeout: 10000 }).catch(() => undefined)
  await page.waitForTimeout(1000)

  return groupId
}

async function createSession(page: Page, groupId: number, uniqueId: string): Promise<number> {
  await page.goto(`${TEST_CONFIG.baseUrl}/document`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  await page.click('text=New Document')
  await page.waitForTimeout(1000)

  const docForInput = page.locator('input[placeholder="Enter client name"]').first()
  await docForInput.waitFor({ state: 'visible', timeout: 10000 })
  await docForInput.click()
  await docForInput.fill(`TestClient_${uniqueId}`)
  await docForInput.press('Escape')
  await page.waitForTimeout(500)

  const docNameInput = page.locator('input[placeholder*="document name"]').first()
  await docNameInput.waitFor({ state: 'visible', timeout: 10000 })
  await docNameInput.fill(`TestDoc_${uniqueId}`)
  await page.waitForTimeout(500)

  const groupSelect = page.locator('select.form-input')
  await groupSelect.waitFor({ state: 'visible', timeout: 10000 })
  await groupSelect.selectOption({ value: String(groupId) })
  await page.waitForTimeout(500)

  const createBtn = page.locator('button').filter({ hasText: /Create Document/ }).first()
  await createBtn.waitFor({ state: 'visible', timeout: 10000 })
  await createBtn.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  const url = page.url()
  const sessionMatch = url.match(/session=(\d+)/)
  const sessionId = sessionMatch ? parseInt(sessionMatch[1], 10) : 0
  if (sessionId) createdSessionIds.push(sessionId)

  return sessionId
}

async function getPersonInputCount(page: Page): Promise<number> {
  const nameInputs = page.getByRole('combobox', { name: 'Full name' })
  return await nameInputs.count()
}

async function getPersonInputValues(page: Page): Promise<string[]> {
  const nameInputs = page.getByRole('combobox', { name: 'Full name' })
  const count = await nameInputs.count()
  const values: string[] = []
  for (let i = 0; i < count; i++) {
    values.push(await nameInputs.nth(i).inputValue())
  }
  return values
}

test.describe('Repeatable Person Deletion Tests', () => {
  test.beforeEach(async ({ page }) => {
    createdGroupIds = []
    createdSessionIds = []
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    for (const sessionId of createdSessionIds) {
      try {
        await page.request.delete(`${TEST_CONFIG.backendUrl}/api/v1/sessions/${sessionId}`)
      } catch (e) { /* ignore */ }
    }
    for (const groupId of createdGroupIds) {
      try {
        await page.request.delete(`${TEST_CONFIG.backendUrl}/api/v1/question-groups/${groupId}`)
      } catch (e) { /* ignore */ }
    }
  })

  test('should delete MIDDLE instance (index 1 of 3) and persist remaining 2', async ({ page }) => {
    test.setTimeout(90000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroupWithPersonQuestion(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List the people', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 3 person names
    const names = ['Alice Smith', 'Bob Jones', 'Charlie Brown']
    for (let i = 0; i < names.length; i++) {
      const nameInputs = page.getByRole('combobox', { name: 'Full name' })
      await nameInputs.nth(i).click()
      await nameInputs.nth(i).fill(names[i])
      await nameInputs.nth(i).press('Escape')
      await nameInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < names.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).first()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(2000)

    // Verify we have 3 instances
    let count = await getPersonInputCount(page)
    expect(count).toBe(3)

    // Delete MIDDLE instance (index 1 = Bob Jones)
    const removeButtons = page.locator('button[title="Remove this entry"]')
    await removeButtons.nth(1).click()
    await page.waitForTimeout(3000)

    // Verify immediate deletion
    count = await getPersonInputCount(page)
    expect(count).toBe(2)

    let values = await getPersonInputValues(page)
    expect(values).toEqual(['Alice Smith', 'Charlie Brown'])

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    count = await getPersonInputCount(page)
    expect(count).toBe(2)

    values = await getPersonInputValues(page)
    expect(values).toEqual(['Alice Smith', 'Charlie Brown'])

    console.log('✓ Middle instance (index 1 of 3) deletion persisted correctly')
  })

  test('should delete MIDDLE instance (index 2 of 5) and persist remaining 4', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroupWithPersonQuestion(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List the people', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 5 person names
    const names = ['Person 1', 'Person 2', 'Person 3', 'Person 4', 'Person 5']
    for (let i = 0; i < names.length; i++) {
      const nameInputs = page.getByRole('combobox', { name: 'Full name' })
      await nameInputs.nth(i).click()
      await nameInputs.nth(i).fill(names[i])
      await nameInputs.nth(i).press('Escape')
      await nameInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < names.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).first()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(2000)

    // Verify we have 5 instances
    let count = await getPersonInputCount(page)
    expect(count).toBe(5)

    // Delete MIDDLE instance (index 2 = Person 3)
    const removeButtons = page.locator('button[title="Remove this entry"]')
    await removeButtons.nth(2).click()
    await page.waitForTimeout(3000)

    // Verify immediate deletion
    count = await getPersonInputCount(page)
    expect(count).toBe(4)

    let values = await getPersonInputValues(page)
    expect(values).toEqual(['Person 1', 'Person 2', 'Person 4', 'Person 5'])

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    count = await getPersonInputCount(page)
    expect(count).toBe(4)

    values = await getPersonInputValues(page)
    expect(values).toEqual(['Person 1', 'Person 2', 'Person 4', 'Person 5'])

    console.log('✓ Middle instance (index 2 of 5) deletion persisted correctly')
  })

  test('should delete FIRST instance and persist remaining', async ({ page }) => {
    test.setTimeout(90000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroupWithPersonQuestion(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List the people', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const names = ['First', 'Second', 'Third']
    for (let i = 0; i < names.length; i++) {
      const nameInputs = page.getByRole('combobox', { name: 'Full name' })
      await nameInputs.nth(i).click()
      await nameInputs.nth(i).fill(names[i])
      await nameInputs.nth(i).press('Escape')
      await nameInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < names.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).first()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(2000)

    // Delete FIRST instance
    const removeButtons = page.locator('button[title="Remove this entry"]')
    await removeButtons.nth(0).click()
    await page.waitForTimeout(3000)

    let values = await getPersonInputValues(page)
    expect(values).toEqual(['Second', 'Third'])

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getPersonInputValues(page)
    expect(values).toEqual(['Second', 'Third'])

    console.log('✓ First instance deletion persisted correctly')
  })

  test('should delete LAST instance and persist remaining', async ({ page }) => {
    test.setTimeout(90000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroupWithPersonQuestion(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List the people', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const names = ['Alpha', 'Beta', 'Gamma']
    for (let i = 0; i < names.length; i++) {
      const nameInputs = page.getByRole('combobox', { name: 'Full name' })
      await nameInputs.nth(i).click()
      await nameInputs.nth(i).fill(names[i])
      await nameInputs.nth(i).press('Escape')
      await nameInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < names.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).first()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(2000)

    // Delete LAST instance
    const removeButtons = page.locator('button[title="Remove this entry"]')
    const count = await removeButtons.count()
    await removeButtons.nth(count - 1).click()
    await page.waitForTimeout(3000)

    let values = await getPersonInputValues(page)
    expect(values).toEqual(['Alpha', 'Beta'])

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getPersonInputValues(page)
    expect(values).toEqual(['Alpha', 'Beta'])

    console.log('✓ Last instance deletion persisted correctly')
  })

  test('should handle multiple middle deletions (delete index 1, then index 1 again)', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroupWithPersonQuestion(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List the people', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const names = ['A', 'B', 'C', 'D', 'E']
    for (let i = 0; i < names.length; i++) {
      const nameInputs = page.getByRole('combobox', { name: 'Full name' })
      await nameInputs.nth(i).click()
      await nameInputs.nth(i).fill(names[i])
      await nameInputs.nth(i).press('Escape')
      await nameInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < names.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).first()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(2000)

    // Delete index 1 (B)
    let removeButtons = page.locator('button[title="Remove this entry"]')
    await removeButtons.nth(1).click()
    await page.waitForTimeout(3000)

    let values = await getPersonInputValues(page)
    expect(values).toEqual(['A', 'C', 'D', 'E'])

    // Delete index 1 again (C)
    removeButtons = page.locator('button[title="Remove this entry"]')
    await removeButtons.nth(1).click()
    await page.waitForTimeout(3000)

    values = await getPersonInputValues(page)
    expect(values).toEqual(['A', 'D', 'E'])

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getPersonInputValues(page)
    expect(values).toEqual(['A', 'D', 'E'])

    console.log('✓ Multiple middle deletions persisted correctly')
  })
})
