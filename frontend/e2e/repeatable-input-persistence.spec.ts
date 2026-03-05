/**
 * E2E Tests for Repeatable Input Persistence
 *
 * Tests that repeatable inputs (text, date, person, radio) correctly persist
 * when adding multiple instances (3-5+) and reloading the page.
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

async function createQuestionGroup(
  page: Page,
  groupName: string,
  questionConfig: {
    identifier: string
    questionText: string
    answerType: string
    isRepeatable: boolean
    radioOptions?: string[]
  }
): Promise<number> {
  await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`)
  await page.waitForLoadState('networkidle')
  await page.click('text=Create Questions Group')
  await page.waitForTimeout(1000)

  const nameInput = page.locator('input.form-input').first()
  await nameInput.waitFor({ state: 'visible', timeout: 10000 })
  await nameInput.fill(groupName)
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

  // Add question
  const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.click()
  await page.waitForTimeout(1000)

  const identifierInput = page.locator('input[placeholder*="full_name"]').first()
  await identifierInput.fill(questionConfig.identifier)
  await page.waitForTimeout(500)

  const questionTextarea = page.locator('.question-builder textarea').first()
  await questionTextarea.fill(questionConfig.questionText)
  await page.waitForTimeout(500)

  // Select answer type
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const answerTypeRadio = page.locator('.radio-group .radio-option').filter({ hasText: questionConfig.answerType }).first()
  await answerTypeRadio.click()
  await page.waitForTimeout(1000)

  // Add radio options if needed
  if (questionConfig.answerType === 'Single Choice (Radio Buttons)' && questionConfig.radioOptions) {
    for (const option of questionConfig.radioOptions) {
      const optionInput = page.locator('input[placeholder^="Option"]').last()
      await optionInput.scrollIntoViewIfNeeded()
      await optionInput.fill(option)
      await page.waitForTimeout(500)

      const addOptionBtn = page.locator('button').filter({ hasText: /Add Option/ }).last()
      if (await addOptionBtn.isVisible()) {
        await addOptionBtn.click()
        await page.waitForTimeout(500)
      }
    }
  }

  // Check "Repeatable" if needed
  if (questionConfig.isRepeatable) {
    const repeatableCheckbox = page.locator('input[type="checkbox"]').first()
    await repeatableCheckbox.scrollIntoViewIfNeeded()
    const isChecked = await repeatableCheckbox.isChecked()
    if (!isChecked) {
      await repeatableCheckbox.click()
      await page.waitForTimeout(1000)
    }
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

test.describe('Repeatable Input Persistence Tests', () => {
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

  test('should persist 5 repeatable text inputs after reload', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroup(page, `E2E_RepeatText_${uniqueId}`, {
      identifier: `child_names_${uniqueId}`,
      questionText: 'What are the names of your children?',
      answerType: 'Text Input Field',
      isRepeatable: true,
    })
    expect(groupId).toBeGreaterThan(0)

    const sessionId = await createSession(page, groupId, uniqueId)
    expect(sessionId).toBeGreaterThan(0)

    await page.waitForSelector('text=What are the names', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Fill 5 text inputs
    const testNames = ['Alice Smith', 'Bob Smith', 'Charlie Smith', 'Diana Smith', 'Eve Smith']

    for (let i = 0; i < testNames.length; i++) {
      // Fill current text input (free_text questions use textarea)
      const textInputs = page.locator('textarea.question-textarea')
      const currentInput = textInputs.nth(i)
      await currentInput.scrollIntoViewIfNeeded()
      await currentInput.fill(testNames[i])
      await currentInput.blur()
      await page.waitForTimeout(2000)

      // Add another if not the last one
      if (i < testNames.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).last()
        await addAnotherBtn.scrollIntoViewIfNeeded()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    // Wait for final save
    await page.waitForTimeout(3000)

    // Reload and verify all 5 persisted
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.waitForSelector('text=What are the names', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const textInputsAfterReload = page.locator('textarea.question-textarea')
    const countAfterReload = await textInputsAfterReload.count()
    expect(countAfterReload).toBeGreaterThanOrEqual(5)

    for (let i = 0; i < testNames.length; i++) {
      const value = await textInputsAfterReload.nth(i).inputValue()
      expect(value).toBe(testNames[i])
    }

    console.log('5 repeatable text inputs persisted correctly')
  })

  test('should persist 4 repeatable date inputs after reload', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroup(page, `E2E_RepeatDate_${uniqueId}`, {
      identifier: `birth_dates_${uniqueId}`,
      questionText: 'What are the birth dates?',
      answerType: 'Date',
      isRepeatable: true,
    })
    expect(groupId).toBeGreaterThan(0)

    const sessionId = await createSession(page, groupId, uniqueId)
    expect(sessionId).toBeGreaterThan(0)

    await page.waitForSelector('text=What are the birth dates', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const testDates = ['1990-01-15', '1992-03-20', '1994-07-10', '1996-12-05']

    for (let i = 0; i < testDates.length; i++) {
      const dateInputs = page.locator('input[type="date"]')
      const currentInput = dateInputs.nth(i)
      await currentInput.scrollIntoViewIfNeeded()
      await currentInput.fill(testDates[i])
      await currentInput.blur()
      await page.waitForTimeout(2000)

      if (i < testDates.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).last()
        await addAnotherBtn.scrollIntoViewIfNeeded()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(3000)

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.waitForSelector('text=What are the birth dates', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const dateInputsAfterReload = page.locator('input[type="date"]')
    const countAfterReload = await dateInputsAfterReload.count()
    expect(countAfterReload).toBeGreaterThanOrEqual(4)

    for (let i = 0; i < testDates.length; i++) {
      const value = await dateInputsAfterReload.nth(i).inputValue()
      expect(value).toBe(testDates[i])
    }

    console.log('4 repeatable date inputs persisted correctly')
  })

  test('should persist 3 repeatable person inputs after reload', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroup(page, `E2E_RepeatPerson_${uniqueId}`, {
      identifier: `executors_${uniqueId}`,
      questionText: 'Who are the executors?',
      answerType: 'Person',
      isRepeatable: true,
    })
    expect(groupId).toBeGreaterThan(0)

    const sessionId = await createSession(page, groupId, uniqueId)
    expect(sessionId).toBeGreaterThan(0)

    await page.waitForSelector('text=Who are the executors', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const testNames = ['Executor One', 'Executor Two', 'Executor Three']

    for (let i = 0; i < testNames.length; i++) {
      const nameInputs = page.getByRole('combobox', { name: 'Full name' })
      const currentInput = nameInputs.nth(i)
      await currentInput.scrollIntoViewIfNeeded()
      await currentInput.click()
      await currentInput.fill(testNames[i])
      await currentInput.press('Escape')
      await currentInput.blur()
      await page.waitForTimeout(2000)

      if (i < testNames.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).last()
        await addAnotherBtn.scrollIntoViewIfNeeded()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(3000)

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.waitForSelector('text=Who are the executors', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const nameInputsAfterReload = page.getByRole('combobox', { name: 'Full name' })
    const countAfterReload = await nameInputsAfterReload.count()
    expect(countAfterReload).toBeGreaterThanOrEqual(3)

    for (let i = 0; i < testNames.length; i++) {
      const value = await nameInputsAfterReload.nth(i).inputValue()
      expect(value).toBe(testNames[i])
    }

    console.log('3 repeatable person inputs persisted correctly')
  })

  test('should persist 5 repeatable radio selections after reload', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    const groupId = await createQuestionGroup(page, `E2E_RepeatRadio_${uniqueId}`, {
      identifier: `asset_types_${uniqueId}`,
      questionText: 'What type of asset is this?',
      answerType: 'Single Choice (Radio Buttons)',
      isRepeatable: true,
      radioOptions: ['Real Estate', 'Vehicle', 'Bank Account', 'Investment'],
    })
    expect(groupId).toBeGreaterThan(0)

    const sessionId = await createSession(page, groupId, uniqueId)
    expect(sessionId).toBeGreaterThan(0)

    await page.waitForSelector('text=What type of asset', { timeout: 15000 })
    await page.waitForTimeout(1000)

    const testSelections = ['Real Estate', 'Vehicle', 'Bank Account', 'Investment', 'Real Estate']

    for (let i = 0; i < testSelections.length; i++) {
      // Find the radio group for the current instance
      const radioLabels = page.locator('label').filter({ hasText: testSelections[i] })

      // Count how many instances we have so far
      let targetIndex = i
      const radio = radioLabels.nth(targetIndex)
      await radio.scrollIntoViewIfNeeded()
      await radio.click()
      await page.waitForTimeout(2000)

      if (i < testSelections.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).last()
        await addAnotherBtn.scrollIntoViewIfNeeded()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(3000)

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await page.waitForSelector('text=What type of asset', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Verify each radio selection persisted
    for (let i = 0; i < testSelections.length; i++) {
      const radioInputs = page.locator('input[type="radio"]:checked')
      const count = await radioInputs.count()
      expect(count).toBeGreaterThanOrEqual(i + 1)

      // Get the label text for the checked radio in this instance
      const checkedRadio = radioInputs.nth(i)
      const label = page.locator(`label[for="${await checkedRadio.getAttribute('id')}"]`)
      const labelText = await label.textContent()
      expect(labelText?.trim()).toBe(testSelections[i])
    }

    console.log('5 repeatable radio selections persisted correctly')
  })

  test('should handle mixed repeatable and non-repeatable fields', async ({ page }) => {
    test.setTimeout(120000)
    const uniqueId = Date.now().toString()

    // Create a group with one non-repeatable and one repeatable question
    await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`)
    await page.waitForLoadState('networkidle')
    await page.click('text=Create Questions Group')
    await page.waitForTimeout(1000)

    const nameInput = page.locator('input.form-input').first()
    await nameInput.fill(`E2E_Mixed_${uniqueId}`)
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

    // Add non-repeatable text question
    const addBtn1 = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
    await addBtn1.click()
    await page.waitForTimeout(1000)

    const identifier1 = page.locator('input[placeholder*="full_name"]').first()
    await identifier1.fill(`doc_title_${uniqueId}`)
    const textarea1 = page.locator('.question-builder textarea').first()
    await textarea1.fill('Document title')
    await page.waitForTimeout(2000)

    // Add repeatable text question
    const addBtn2 = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
    await addBtn2.click()
    await page.waitForTimeout(1000)

    const identifiers = page.locator('input[placeholder*="full_name"]')
    await identifiers.nth(1).fill(`beneficiaries_${uniqueId}`)
    const textareas = page.locator('.question-builder textarea')
    await textareas.nth(1).fill('List beneficiaries')
    await page.waitForTimeout(1000)

    // Make second question repeatable
    const repeatableCheckbox = page.locator('input[type="checkbox"]').nth(1)
    await repeatableCheckbox.scrollIntoViewIfNeeded()
    if (!(await repeatableCheckbox.isChecked())) {
      await repeatableCheckbox.click()
      await page.waitForTimeout(1000)
    }

    // Create session
    const sessionId = await createSession(page, groupId, uniqueId)
    expect(sessionId).toBeGreaterThan(0)

    await page.waitForTimeout(2000)

    // Fill non-repeatable field (free_text uses textarea)
    const titleInputs = page.locator('textarea.question-textarea')
    await titleInputs.first().fill('My Estate Plan')
    await titleInputs.first().blur()
    await page.waitForTimeout(2000)

    // Fill 3 repeatable fields
    const beneficiaryNames = ['Ben One', 'Ben Two', 'Ben Three']
    for (let i = 0; i < beneficiaryNames.length; i++) {
      const inputs = page.locator('textarea.question-textarea')
      const currentInput = inputs.nth(1 + i) // Skip the title field
      await currentInput.scrollIntoViewIfNeeded()
      await currentInput.fill(beneficiaryNames[i])
      await currentInput.blur()
      await page.waitForTimeout(2000)

      if (i < beneficiaryNames.length - 1) {
        const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).last()
        await addAnotherBtn.scrollIntoViewIfNeeded()
        await addAnotherBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(3000)

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const allInputsAfterReload = page.locator('textarea.question-textarea')
    const countAfterReload = await allInputsAfterReload.count()
    expect(countAfterReload).toBeGreaterThanOrEqual(4) // 1 non-repeatable + 3 repeatable

    const titleValue = await allInputsAfterReload.first().inputValue()
    expect(titleValue).toBe('My Estate Plan')

    for (let i = 0; i < beneficiaryNames.length; i++) {
      const value = await allInputsAfterReload.nth(1 + i).inputValue()
      expect(value).toBe(beneficiaryNames[i])
    }

    console.log('Mixed repeatable and non-repeatable fields persisted correctly')
  })
})
