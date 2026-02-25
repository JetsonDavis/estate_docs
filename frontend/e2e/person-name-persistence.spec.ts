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
  // Create group via admin UI
  await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`)
  await page.waitForLoadState('networkidle')
  await page.click('text=Create Questions Group')
  await page.waitForTimeout(1000)

  const nameInput = page.locator('input.form-input').first()
  await nameInput.waitFor({ state: 'visible', timeout: 10000 })
  await nameInput.fill(`E2E_PersonPersist_${uniqueId}`)
  await page.waitForTimeout(500)

  const checkingName = page.getByText('Checking name...')
  if (await checkingName.isVisible().catch(() => false)) {
    await checkingName.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined)
  }
  await page.waitForTimeout(1000)

  await page.click('text=Save Group Information')
  await page.waitForSelector('text=Questions', { timeout: 10000 })
  await page.waitForTimeout(1000)

  // Extract group ID
  const url = page.url()
  const match = url.match(/\/question-groups\/(\d+)/)
  const groupId = match ? parseInt(match[1], 10) : 0
  if (groupId) createdGroupIds.push(groupId)

  // Add a person-type question
  const addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.click()
  await page.waitForTimeout(1000)

  // Set identifier
  const identifierInput = page.locator('input[placeholder*="full_name"]').first()
  await identifierInput.fill(`trustors_${uniqueId}`)
  await page.waitForTimeout(500)

  // Set question text
  const questionTextarea = page.locator('.question-builder textarea').first()
  await questionTextarea.fill('Who is/are the trustor(s)?')
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

  return groupId
}

async function createSession(page: Page, groupId: number, uniqueId: string): Promise<number> {
  // Navigate to Input Form and create a new session
  await page.goto(`${TEST_CONFIG.baseUrl}/document`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)

  await page.click('text=New Document')
  await page.waitForTimeout(1000)

  // Fill in "Document For:" field
  const docForInput = page.locator('input').first()
  await docForInput.waitFor({ state: 'visible', timeout: 10000 })
  await docForInput.fill(`TestClient_${uniqueId}`)

  // Fill in "Document Name:" field
  const docNameInput = page.locator('input[placeholder*="document name"]').first()
  if (await docNameInput.isVisible().catch(() => false)) {
    await docNameInput.fill(`TestDoc_${uniqueId}`)
  }

  await page.waitForTimeout(500)

  // Click "Create Document" button
  const createBtn = page.locator('button').filter({ hasText: /Create Document/ }).first()
  await createBtn.waitFor({ state: 'visible', timeout: 10000 })
  await createBtn.click()
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)

  // Extract session ID from URL
  const url = page.url()
  const sessionMatch = url.match(/session=(\d+)/)
  const sessionId = sessionMatch ? parseInt(sessionMatch[1], 10) : 0
  if (sessionId) createdSessionIds.push(sessionId)

  return sessionId
}

test.describe('Person Name Persistence', () => {
  test.beforeEach(async ({ page }) => {
    createdGroupIds = []
    createdSessionIds = []
    await login(page)
  })

  test.afterEach(async ({ page }) => {
    // Clean up sessions
    for (const sessionId of createdSessionIds) {
      try {
        await page.request.delete(`${TEST_CONFIG.backendUrl}/api/v1/sessions/${sessionId}`)
      } catch (e) { /* ignore */ }
    }
    // Clean up groups
    for (const groupId of createdGroupIds) {
      try {
        await page.request.delete(`${TEST_CONFIG.backendUrl}/api/v1/question-groups/${groupId}`)
      } catch (e) { /* ignore */ }
    }
  })

  test('should persist person name after entering and reloading', async ({ page }) => {
    const uniqueId = Date.now().toString()

    // Create a question group with a repeatable person question
    const groupId = await createQuestionGroupWithPersonQuestion(page, uniqueId)
    expect(groupId).toBeGreaterThan(0)

    // Create a session using this group
    const sessionId = await createSession(page, groupId, uniqueId)
    expect(sessionId).toBeGreaterThan(0)

    // Wait for the person question to appear
    await page.waitForSelector('text=Who is/are the trustor', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Find the Name input and enter a name
    const nameInput = page.locator('input[placeholder="Full name"]').first()
    await nameInput.waitFor({ state: 'visible', timeout: 10000 })
    await nameInput.fill('John Smith')
    await page.waitForTimeout(500)

    // Blur to trigger save
    await nameInput.blur()
    await page.waitForTimeout(3000) // Wait for debounced save

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Wait for the person question to re-render
    await page.waitForSelector('text=Who is/are the trustor', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Verify the name persisted
    const nameInputAfterReload = page.locator('input[placeholder="Full name"]').first()
    await nameInputAfterReload.waitFor({ state: 'visible', timeout: 10000 })
    const persistedName = await nameInputAfterReload.inputValue()
    expect(persistedName).toBe('John Smith')

    console.log('Person name persistence test: passed')
  })

  test('should persist multiple person names with conjunctions after reload', async ({ page }) => {
    const uniqueId = Date.now().toString()

    // Create a question group with a repeatable person question
    const groupId = await createQuestionGroupWithPersonQuestion(page, uniqueId)
    expect(groupId).toBeGreaterThan(0)

    // Create a session using this group
    const sessionId = await createSession(page, groupId, uniqueId)
    expect(sessionId).toBeGreaterThan(0)

    // Wait for the person question to appear
    await page.waitForSelector('text=Who is/are the trustor', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Enter first person name
    const nameInput1 = page.locator('input[placeholder="Full name"]').first()
    await nameInput1.waitFor({ state: 'visible', timeout: 10000 })
    await nameInput1.fill('Alice Johnson')
    await nameInput1.blur()
    await page.waitForTimeout(2000)

    // Click "Add Another" to add a second person
    const addAnotherBtn = page.locator('button').filter({ hasText: /Add Another/ }).first()
    await addAnotherBtn.scrollIntoViewIfNeeded()
    await addAnotherBtn.click()
    await page.waitForTimeout(1500)

    // Enter second person name
    const nameInputs = page.locator('input[placeholder="Full name"]')
    const count = await nameInputs.count()
    expect(count).toBeGreaterThanOrEqual(2)

    const nameInput2 = nameInputs.nth(count - 1)
    await nameInput2.scrollIntoViewIfNeeded()
    await nameInput2.fill('Bob Johnson')
    await nameInput2.blur()
    await page.waitForTimeout(3000) // Wait for debounced save

    // Reload the page
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Wait for person questions to re-render
    await page.waitForSelector('text=Who is/are the trustor', { timeout: 15000 })
    await page.waitForTimeout(1000)

    // Verify both names persisted
    const nameInputsAfterReload = page.locator('input[placeholder="Full name"]')
    const countAfterReload = await nameInputsAfterReload.count()
    expect(countAfterReload).toBeGreaterThanOrEqual(2)

    const persistedName1 = await nameInputsAfterReload.first().inputValue()
    expect(persistedName1).toBe('Alice Johnson')

    // The second name input
    const persistedName2 = await nameInputsAfterReload.nth(1).inputValue()
    expect(persistedName2).toBe('Bob Johnson')

    console.log('Multiple person names persistence test: passed')
  })
})
