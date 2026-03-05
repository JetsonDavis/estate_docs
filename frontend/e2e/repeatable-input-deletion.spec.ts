/**
 * E2E Tests for Repeatable Input Deletion
 *
 * Tests that repeatable inputs can be deleted correctly from any position
 * (first, middle, last) and that remaining inputs persist correctly.
 */

import { test, expect, Page } from '@playwright/test'

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3005',
  backendUrl: 'http://localhost:8005',
  adminEmail: 'admin',
  adminPassword: 'password',
}

let createdGroupIds: number[] = []
let createdSessionIds: number[] = []

async function login(page: Page) {
  await page.goto(`${TEST_CONFIG.baseUrl}/login`)
  await page.fill('input[id="username"]', TEST_CONFIG.adminEmail)
  await page.fill('input[id="password"]', TEST_CONFIG.adminPassword)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
}

async function createRepeatableTextGroup(page: Page, uniqueId: string): Promise<number> {
  await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`)
  await page.waitForLoadState('networkidle')
  await page.click('text=Create Questions Group')
  await page.waitForTimeout(1000)

  const nameInput = page.locator('input.form-input').first()
  await nameInput.fill(`E2E_DeleteTest_${uniqueId}`)
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

  // Add repeatable text question
  const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.click()
  await page.waitForTimeout(1000)

  const identifierInput = page.locator('input[placeholder*="full_name"]').first()
  await identifierInput.fill(`items_${uniqueId}`)
  await page.waitForTimeout(500)

  const questionTextarea = page.locator('.question-builder textarea').first()
  await questionTextarea.fill('List your items')
  await page.waitForTimeout(500)

  // Select "Text Input Field" answer type
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const textRadio = page.locator('text=Text Input Field').first()
  await textRadio.click()
  await page.waitForTimeout(1000)

  // Make it repeatable
  const repeatableCheckbox = page.locator('input[type="checkbox"]').first()
  await repeatableCheckbox.scrollIntoViewIfNeeded()
  if (!(await repeatableCheckbox.isChecked())) {
    await repeatableCheckbox.click()
    await page.waitForTimeout(1000)
  }

  return groupId
}

async function createSession(page: Page, groupId: number, uniqueId: string): Promise<number> {
  await page.goto(`${TEST_CONFIG.baseUrl}/document`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  await page.click('text=New Document')
  await page.waitForTimeout(1000)

  const docForInput = page.locator('input[placeholder="Enter client name"]').first()
  await docForInput.click()
  await docForInput.fill(`Client_${uniqueId}`)
  await docForInput.press('Escape')
  await page.waitForTimeout(500)

  const docNameInput = page.locator('input[placeholder*="document name"]').first()
  await docNameInput.fill(`Doc_${uniqueId}`)
  await page.waitForTimeout(500)

  const groupSelect = page.locator('select.form-input')
  await groupSelect.selectOption({ value: String(groupId) })
  await page.waitForTimeout(500)

  const createBtn = page.locator('button').filter({ hasText: /Create Document/ }).first()
  await createBtn.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  const url = page.url()
  const sessionMatch = url.match(/session=(\d+)/)
  const sessionId = sessionMatch ? parseInt(sessionMatch[1], 10) : 0
  if (sessionId) createdSessionIds.push(sessionId)

  return sessionId
}

async function fillRepeatableTextInputs(page: Page, values: string[]) {
  for (let i = 0; i < values.length; i++) {
    const textInputs = page.locator('textarea.question-textarea')
    const currentInput = textInputs.nth(i)
    await currentInput.scrollIntoViewIfNeeded()
    await currentInput.fill(values[i])
    await currentInput.blur()
    await page.waitForTimeout(2000)

    if (i < values.length - 1) {
      const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).last()
      await addAnotherBtn.scrollIntoViewIfNeeded()
      await addAnotherBtn.click()
      await page.waitForTimeout(1500)
    }
  }
  await page.waitForTimeout(2000)
}

async function getTextInputValues(page: Page): Promise<string[]> {
  const textInputs = page.locator('textarea.question-textarea')
  const count = await textInputs.count()
  const values: string[] = []
  for (let i = 0; i < count; i++) {
    values.push(await textInputs.nth(i).inputValue())
  }
  return values
}

async function deleteRepeatableInstance(page: Page, index: number) {
  // Find all "Remove" buttons for repeatable instances
  const removeButtons = page.locator('button').filter({ hasText: /Remove/i })
  const count = await removeButtons.count()

  if (index < count) {
    const targetButton = removeButtons.nth(index)
    await targetButton.scrollIntoViewIfNeeded()
    await targetButton.click()
    await page.waitForTimeout(2000)
  }
}

test.describe('Repeatable Input Deletion Tests', () => {
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

  test('should delete first instance and persist remaining 4', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createRepeatableTextGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List your items', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 5 instances
    const originalValues = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5']
    await fillRepeatableTextInputs(page, originalValues)

    // Delete first instance (index 0)
    await deleteRepeatableInstance(page, 0)
    await page.waitForTimeout(2000)

    // Verify count decreased
    let values = await getTextInputValues(page)
    expect(values.length).toBe(4)
    expect(values).toEqual(['Item 2', 'Item 3', 'Item 4', 'Item 5'])

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values.length).toBe(4)
    expect(values).toEqual(['Item 2', 'Item 3', 'Item 4', 'Item 5'])

    console.log('First instance deletion persisted correctly')
  })

  test('should delete middle instance (index 2 of 5) and persist remaining', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createRepeatableTextGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List your items', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 5 instances
    const originalValues = ['First', 'Second', 'Third', 'Fourth', 'Fifth']
    await fillRepeatableTextInputs(page, originalValues)

    // Delete middle instance (index 2 = "Third")
    await deleteRepeatableInstance(page, 2)
    await page.waitForTimeout(2000)

    // Verify immediate deletion
    let values = await getTextInputValues(page)
    expect(values.length).toBe(4)
    expect(values).toEqual(['First', 'Second', 'Fourth', 'Fifth'])

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values.length).toBe(4)
    expect(values).toEqual(['First', 'Second', 'Fourth', 'Fifth'])

    console.log('Middle instance (index 2) deletion persisted correctly')
  })

  test('should delete last instance and persist remaining', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createRepeatableTextGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List your items', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 5 instances
    const originalValues = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon']
    await fillRepeatableTextInputs(page, originalValues)

    // Delete last instance (index 4)
    await deleteRepeatableInstance(page, 4)
    await page.waitForTimeout(2000)

    // Verify immediate deletion
    let values = await getTextInputValues(page)
    expect(values.length).toBe(4)
    expect(values).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta'])

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values.length).toBe(4)
    expect(values).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta'])

    console.log('Last instance deletion persisted correctly')
  })

  test('should delete multiple middle instances (index 1 and 3 of 5)', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createRepeatableTextGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List your items', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 5 instances
    const originalValues = ['One', 'Two', 'Three', 'Four', 'Five']
    await fillRepeatableTextInputs(page, originalValues)

    // Delete index 1 ("Two")
    await deleteRepeatableInstance(page, 1)
    await page.waitForTimeout(2000)

    let values = await getTextInputValues(page)
    expect(values.length).toBe(4)
    expect(values).toEqual(['One', 'Three', 'Four', 'Five'])

    // Delete index 2 (which is now "Four")
    await deleteRepeatableInstance(page, 2)
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values.length).toBe(3)
    expect(values).toEqual(['One', 'Three', 'Five'])

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values.length).toBe(3)
    expect(values).toEqual(['One', 'Three', 'Five'])

    console.log('Multiple middle instances deletion persisted correctly')
  })

  test('should delete all but one instance', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createRepeatableTextGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List your items', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 4 instances
    const originalValues = ['Keep This', 'Delete 1', 'Delete 2', 'Delete 3']
    await fillRepeatableTextInputs(page, originalValues)

    // Delete instances from the end to avoid index shifting issues
    for (let i = 3; i >= 1; i--) {
      await deleteRepeatableInstance(page, i)
      await page.waitForTimeout(1500)
    }

    // Verify only one remains
    let values = await getTextInputValues(page)
    expect(values.length).toBe(1)
    expect(values).toEqual(['Keep This'])

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values.length).toBe(1)
    expect(values).toEqual(['Keep This'])

    console.log('Delete all but one instance persisted correctly')
  })

  test('should delete instance, add new one, then delete again', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createRepeatableTextGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=List your items', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 3 instances
    const initialValues = ['A', 'B', 'C']
    await fillRepeatableTextInputs(page, initialValues)

    // Delete middle (index 1 = "B")
    await deleteRepeatableInstance(page, 1)
    await page.waitForTimeout(2000)

    let values = await getTextInputValues(page)
    expect(values).toEqual(['A', 'C'])

    // Add a new instance
    const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).last()
    await addAnotherBtn.scrollIntoViewIfNeeded()
    await addAnotherBtn.click()
    await page.waitForTimeout(1500)

    const textInputs = page.locator('textarea.question-textarea')
    const newInput = textInputs.last()
    await newInput.fill('D')
    await newInput.blur()
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values).toEqual(['A', 'C', 'D'])

    // Delete first (index 0 = "A")
    await deleteRepeatableInstance(page, 0)
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values).toEqual(['C', 'D'])

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    values = await getTextInputValues(page)
    expect(values).toEqual(['C', 'D'])

    console.log('Complex delete-add-delete pattern persisted correctly')
  })

  test('should handle deletion of middle instance with person type', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    // Create repeatable person question group
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`)
    await page.waitForLoadState('networkidle')
    await page.click('text=Create Questions Group')
    await page.waitForTimeout(1000)

    const nameInput = page.locator('input.form-input').first()
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

    const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
    await addBtn.click()
    await page.waitForTimeout(1000)

    const identifierInput = page.locator('input[placeholder*="full_name"]').first()
    await identifierInput.fill(`witnesses_${uniqueId}`)
    const questionTextarea = page.locator('.question-builder textarea').first()
    await questionTextarea.fill('Who are the witnesses?')
    await page.waitForTimeout(500)

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    const personRadio = page.locator('text=Person').first()
    await personRadio.click()
    await page.waitForTimeout(1000)

    const repeatableCheckbox = page.locator('input[type="checkbox"]').first()
    await repeatableCheckbox.scrollIntoViewIfNeeded()
    if (!(await repeatableCheckbox.isChecked())) {
      await repeatableCheckbox.click()
      await page.waitForTimeout(1000)
    }

    // Create session
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForSelector('text=Who are the witnesses', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 4 person instances
    const witnessNames = ['Witness A', 'Witness B', 'Witness C', 'Witness D']
    for (let i = 0; i < witnessNames.length; i++) {
      const nameInputs = page.getByRole('combobox', { name: 'Full name' })
      const currentInput = nameInputs.nth(i)
      await currentInput.scrollIntoViewIfNeeded()
      await currentInput.click()
      await currentInput.fill(witnessNames[i])
      await currentInput.press('Escape')
      await currentInput.blur()
      await page.waitForTimeout(2000)

      if (i < witnessNames.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).last()
        await addAnotherBtn.scrollIntoViewIfNeeded()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    // Delete middle instance (index 1 = "Witness B")
    await deleteRepeatableInstance(page, 1)
    await page.waitForTimeout(2000)

    // Verify immediate deletion
    const nameInputsAfterDelete = page.getByRole('combobox', { name: 'Full name' })
    const count = await nameInputsAfterDelete.count()
    expect(count).toBe(3)

    const values = []
    for (let i = 0; i < count; i++) {
      values.push(await nameInputsAfterDelete.nth(i).inputValue())
    }
    expect(values).toEqual(['Witness A', 'Witness C', 'Witness D'])

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const nameInputsAfterReload = page.getByRole('combobox', { name: 'Full name' })
    const countAfterReload = await nameInputsAfterReload.count()
    expect(countAfterReload).toBe(3)

    const valuesAfterReload = []
    for (let i = 0; i < countAfterReload; i++) {
      valuesAfterReload.push(await nameInputsAfterReload.nth(i).inputValue())
    }
    expect(valuesAfterReload).toEqual(['Witness A', 'Witness C', 'Witness D'])

    console.log('Person type middle instance deletion persisted correctly')
  })
})
