/**
 * E2E Tests for Multiple Repeatable Groups Interaction
 *
 * Tests that multiple repeatable question groups on the same form
 * interact correctly, persist independently, and handle deletions properly.
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

async function createMultiRepeatableGroup(page: Page, uniqueId: string): Promise<number> {
  await page.goto(`${TEST_CONFIG.baseUrl}/admin/question-groups`)
  await page.waitForLoadState('networkidle')
  await page.click('text=Create Questions Group')
  await page.waitForTimeout(1000)

  const nameInput = page.locator('input.form-input').first()
  await nameInput.fill(`E2E_MultiRepeat_${uniqueId}`)
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

  // Add first repeatable text question (beneficiaries)
  let addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.click()
  await page.waitForTimeout(1000)

  let identifiers = page.locator('input[placeholder*="full_name"]')
  await identifiers.nth(0).fill(`beneficiaries_${uniqueId}`)
  let textareas = page.locator('.question-builder textarea')
  await textareas.nth(0).fill('List beneficiaries')
  await page.waitForTimeout(500)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  let textRadio = page.locator('text=Text Input Field').nth(0)
  await textRadio.click()
  await page.waitForTimeout(1000)

  let repeatableCheckboxes = page.locator('input[type="checkbox"]')
  await repeatableCheckboxes.nth(0).scrollIntoViewIfNeeded()
  if (!(await repeatableCheckboxes.nth(0).isChecked())) {
    await repeatableCheckboxes.nth(0).click()
    await page.waitForTimeout(1000)
  }

  // Add second repeatable text question (assets)
  addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.click()
  await page.waitForTimeout(1000)

  identifiers = page.locator('input[placeholder*="full_name"]')
  await identifiers.nth(1).fill(`assets_${uniqueId}`)
  textareas = page.locator('.question-builder textarea')
  await textareas.nth(1).fill('List assets')
  await page.waitForTimeout(500)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  textRadio = page.locator('text=Text Input Field').nth(1)
  await textRadio.click()
  await page.waitForTimeout(1000)

  // Second question shows radio buttons instead of checkbox since a repeatable group exists
  const startNewRadio2 = page.locator('text=Start New Repeatable Group').last()
  await startNewRadio2.scrollIntoViewIfNeeded()
  await startNewRadio2.click()
  await page.waitForTimeout(1000)

  // Add third repeatable date question (important dates)
  addBtn = page.locator('button').filter({ hasText: /^Add Question$/ }).last()
  await addBtn.click()
  await page.waitForTimeout(1000)

  identifiers = page.locator('input[placeholder*="full_name"]')
  await identifiers.nth(2).fill(`dates_${uniqueId}`)
  textareas = page.locator('.question-builder textarea')
  await textareas.nth(2).fill('Important dates')
  await page.waitForTimeout(500)

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(500)
  const dateRadio = page.locator('.radio-group .radio-option').filter({ hasText: 'Date' }).nth(2)
  await dateRadio.click()
  await page.waitForTimeout(1000)

  // Third question also shows radio buttons for repeatable
  const startNewRadio3 = page.locator('text=Start New Repeatable Group').last()
  await startNewRadio3.scrollIntoViewIfNeeded()
  await startNewRadio3.click()
  await page.waitForTimeout(1000)

  // Wait for auto-save to complete so all repeatable flags are persisted
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

test.describe('Multiple Repeatable Groups Tests', () => {
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

  test('should persist multiple repeatable groups independently', async ({ page }) => {
    test.setTimeout(150000)
    const uniqueId = Date.now().toString()

    const groupId = await createMultiRepeatableGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForTimeout(2000)

    // Fill beneficiaries (3 instances)
    const beneficiaries = ['Ben 1', 'Ben 2', 'Ben 3']
    for (let i = 0; i < beneficiaries.length; i++) {
      const textInputs = page.locator('textarea.question-textarea')
      await textInputs.nth(i).scrollIntoViewIfNeeded()
      await textInputs.nth(i).fill(beneficiaries[i])
      await textInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < beneficiaries.length - 1) {
        const addBtns = page.locator('button').filter({ hasText: /Add Another/ })
        await addBtns.first().scrollIntoViewIfNeeded()
        await addBtns.first().click()
        await page.waitForTimeout(1500)
      }
    }

    // Scroll to see assets section
    await page.evaluate(() => window.scrollBy(0, 300))
    await page.waitForTimeout(500)

    // Fill assets (4 instances)
    const assets = ['House', 'Car', 'Stocks', 'Savings']
    for (let i = 0; i < assets.length; i++) {
      const textInputs = page.locator('textarea.question-textarea')
      const assetInput = textInputs.nth(beneficiaries.length + i)
      await assetInput.scrollIntoViewIfNeeded()
      await assetInput.fill(assets[i])
      await assetInput.blur()
      await page.waitForTimeout(2000)

      if (i < assets.length - 1) {
        const addBtns = page.locator('button').filter({ hasText: /Add Another/ })
        const assetAddBtn = addBtns.nth(1)
        await assetAddBtn.scrollIntoViewIfNeeded()
        await assetAddBtn.click()
        await page.waitForTimeout(1500)
      }
    }

    // Scroll to see dates section
    await page.evaluate(() => window.scrollBy(0, 300))
    await page.waitForTimeout(500)

    // Fill dates (2 instances)
    const dates = ['2024-01-15', '2024-06-20']
    for (let i = 0; i < dates.length; i++) {
      const dateInputs = page.locator('input[type="date"]')
      await dateInputs.nth(i).scrollIntoViewIfNeeded()
      await dateInputs.nth(i).fill(dates[i])
      await dateInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < dates.length - 1) {
        const addBtns = page.locator('button').filter({ hasText: /Add Another/ })
        await addBtns.last().scrollIntoViewIfNeeded()
        await addBtns.last().click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(3000)

    // Reload and verify all groups persisted independently
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Verify beneficiaries
    const textInputsAfterReload = page.locator('textarea.question-textarea')
    for (let i = 0; i < beneficiaries.length; i++) {
      const value = await textInputsAfterReload.nth(i).inputValue()
      expect(value).toBe(beneficiaries[i])
    }

    // Verify assets
    for (let i = 0; i < assets.length; i++) {
      const value = await textInputsAfterReload.nth(beneficiaries.length + i).inputValue()
      expect(value).toBe(assets[i])
    }

    // Verify dates
    const dateInputsAfterReload = page.locator('input[type="date"]')
    for (let i = 0; i < dates.length; i++) {
      const value = await dateInputsAfterReload.nth(i).inputValue()
      expect(value).toBe(dates[i])
    }

    console.log('Multiple repeatable groups persisted independently')
  })

  test('should handle deletion in one group without affecting others', async ({ page }) => {
    test.setTimeout(150000)
    const uniqueId = Date.now().toString()

    const groupId = await createMultiRepeatableGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForTimeout(2000)

    // Fill beneficiaries (3 instances)
    const beneficiaries = ['Alice', 'Bob', 'Charlie']
    for (let i = 0; i < beneficiaries.length; i++) {
      const textInputs = page.locator('textarea.question-textarea')
      await textInputs.nth(i).fill(beneficiaries[i])
      await textInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < beneficiaries.length - 1) {
        const addBtns = page.locator('button').filter({ hasText: /Add Another/ })
        await addBtns.first().click()
        await page.waitForTimeout(1500)
      }
    }

    // Fill assets (3 instances)
    await page.evaluate(() => window.scrollBy(0, 300))
    await page.waitForTimeout(500)

    const assets = ['Asset A', 'Asset B', 'Asset C']
    for (let i = 0; i < assets.length; i++) {
      const textInputs = page.locator('textarea.question-textarea')
      const assetInput = textInputs.nth(beneficiaries.length + i)
      await assetInput.fill(assets[i])
      await assetInput.blur()
      await page.waitForTimeout(2000)

      if (i < assets.length - 1) {
        const addBtns = page.locator('button').filter({ hasText: /Add Another/ })
        await addBtns.nth(1).click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(2000)

    // Delete middle beneficiary (index 1 = "Bob")
    const removeBtns = page.locator('button').filter({ hasText: /Remove/i })
    await removeBtns.nth(1).scrollIntoViewIfNeeded()
    await removeBtns.nth(1).click()
    await page.waitForTimeout(2000)

    // Verify beneficiaries changed but assets didn't
    const textInputsAfterDelete = page.locator('textarea.question-textarea')
    const beneficiaryCount = 2 // Alice and Charlie remain

    const beneficiaryValues = []
    for (let i = 0; i < beneficiaryCount; i++) {
      beneficiaryValues.push(await textInputsAfterDelete.nth(i).inputValue())
    }
    expect(beneficiaryValues).toEqual(['Alice', 'Charlie'])

    const assetValues = []
    for (let i = 0; i < assets.length; i++) {
      assetValues.push(await textInputsAfterDelete.nth(beneficiaryCount + i).inputValue())
    }
    expect(assetValues).toEqual(['Asset A', 'Asset B', 'Asset C'])

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const textInputsAfterReload = page.locator('textarea.question-textarea')

    const beneficiaryValuesAfterReload = []
    for (let i = 0; i < beneficiaryCount; i++) {
      beneficiaryValuesAfterReload.push(await textInputsAfterReload.nth(i).inputValue())
    }
    expect(beneficiaryValuesAfterReload).toEqual(['Alice', 'Charlie'])

    const assetValuesAfterReload = []
    for (let i = 0; i < assets.length; i++) {
      assetValuesAfterReload.push(await textInputsAfterReload.nth(beneficiaryCount + i).inputValue())
    }
    expect(assetValuesAfterReload).toEqual(['Asset A', 'Asset B', 'Asset C'])

    console.log('Deletion in one group did not affect other groups')
  })

  test('should handle complex operations across multiple groups', async ({ page }) => {
    test.setTimeout(150000)
    const uniqueId = Date.now().toString()

    const groupId = await createMultiRepeatableGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForTimeout(2000)

    // Fill beneficiaries (4 instances)
    const beneficiaries = ['B1', 'B2', 'B3', 'B4']
    for (let i = 0; i < beneficiaries.length; i++) {
      const textInputs = page.locator('textarea.question-textarea')
      await textInputs.nth(i).fill(beneficiaries[i])
      await textInputs.nth(i).blur()
      await page.waitForTimeout(2000)

      if (i < beneficiaries.length - 1) {
        const addBtns = page.locator('button').filter({ hasText: /Add Another/ })
        await addBtns.first().click()
        await page.waitForTimeout(1500)
      }
    }

    // Fill assets (3 instances)
    await page.evaluate(() => window.scrollBy(0, 300))
    await page.waitForTimeout(500)

    const assets = ['A1', 'A2', 'A3']
    for (let i = 0; i < assets.length; i++) {
      const textInputs = page.locator('textarea.question-textarea')
      await textInputs.nth(beneficiaries.length + i).fill(assets[i])
      await textInputs.nth(beneficiaries.length + i).blur()
      await page.waitForTimeout(2000)

      if (i < assets.length - 1) {
        const addBtns = page.locator('button').filter({ hasText: /Add Another/ })
        await addBtns.nth(1).click()
        await page.waitForTimeout(1500)
      }
    }

    await page.waitForTimeout(2000)

    // Delete beneficiary at index 0 (B1)
    const removeBtns1 = page.locator('button').filter({ hasText: /Remove/i })
    await removeBtns1.nth(0).scrollIntoViewIfNeeded()
    await removeBtns1.nth(0).click()
    await page.waitForTimeout(2000)

    // Delete asset at index 1 (A2, which is now at position beneficiaries.length - 1 + 1 in remove buttons)
    const removeBtns2 = page.locator('button').filter({ hasText: /Remove/i })
    // After deleting B1, we have 3 beneficiary remove buttons (for B2, B3, B4) + asset remove buttons
    // Asset A2 is at index 3 + 1 = 4 in the remove button list
    await removeBtns2.nth(4).scrollIntoViewIfNeeded()
    await removeBtns2.nth(4).click()
    await page.waitForTimeout(2000)

    // Add one more beneficiary
    const addBtns = page.locator('button').filter({ hasText: /Add Another/ })
    await addBtns.first().scrollIntoViewIfNeeded()
    await addBtns.first().click()
    await page.waitForTimeout(1500)

    const textInputs = page.locator('textarea.question-textarea')
    const newBenInput = textInputs.nth(3) // B2, B3, B4, and new one
    await newBenInput.fill('B5')
    await newBenInput.blur()
    await page.waitForTimeout(2000)

    // Reload and verify complex state
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const textInputsAfterReload = page.locator('textarea.question-textarea')

    // Should have: B2, B3, B4, B5 (4 beneficiaries)
    const beneficiaryCount = 4
    const expectedBeneficiaries = ['B2', 'B3', 'B4', 'B5']
    for (let i = 0; i < beneficiaryCount; i++) {
      const value = await textInputsAfterReload.nth(i).inputValue()
      expect(value).toBe(expectedBeneficiaries[i])
    }

    // Should have: A1, A3 (2 assets, A2 was deleted)
    const expectedAssets = ['A1', 'A3']
    for (let i = 0; i < expectedAssets.length; i++) {
      const value = await textInputsAfterReload.nth(beneficiaryCount + i).inputValue()
      expect(value).toBe(expectedAssets[i])
    }

    console.log('Complex operations across multiple groups persisted correctly')
  })

  test('should handle adding instances to multiple groups simultaneously', async ({ page }) => {
    test.setTimeout(150000)
    const uniqueId = Date.now().toString()

    const groupId = await createMultiRepeatableGroup(page, uniqueId)
    const sessionId = await createSession(page, groupId, uniqueId)

    await page.waitForTimeout(2000)

    // Fill 1 beneficiary
    const textInputs1 = page.locator('textarea.question-textarea')
    await textInputs1.nth(0).fill('Initial Ben')
    await textInputs1.nth(0).blur()
    await page.waitForTimeout(2000)

    // Add another beneficiary
    const addBtns1 = page.locator('button').filter({ hasText: /Add Another/ })
    await addBtns1.first().click()
    await page.waitForTimeout(1500)

    // After adding another beneficiary, textareas are:
    // [0] = beneficiary 1 ("Initial Ben"), [1] = beneficiary 2 (empty), [2] = assets 1 (empty)

    // Fill second beneficiary (index 1)
    const textInputs2 = page.locator('textarea.question-textarea')
    await textInputs2.nth(1).fill('Second Ben')
    await textInputs2.nth(1).blur()
    await page.waitForTimeout(2000)

    // Fill 1 asset (index 2)
    await page.evaluate(() => window.scrollBy(0, 300))
    await page.waitForTimeout(500)

    const textInputs3 = page.locator('textarea.question-textarea')
    await textInputs3.nth(2).fill('Initial Asset')
    await textInputs3.nth(2).blur()
    await page.waitForTimeout(2000)

    // Add another asset
    const addBtns2 = page.locator('button').filter({ hasText: /Add Another/ })
    await addBtns2.nth(1).click()
    await page.waitForTimeout(1500)

    // After adding another asset, textareas are:
    // [0] = ben 1, [1] = ben 2, [2] = asset 1 ("Initial Asset"), [3] = asset 2 (empty)
    const textInputs4 = page.locator('textarea.question-textarea')
    await textInputs4.nth(3).fill('Second Asset')
    await textInputs4.nth(3).blur()
    await page.waitForTimeout(3000)

    // Reload and verify
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    const textInputsAfterReload = page.locator('textarea.question-textarea')

    expect(await textInputsAfterReload.nth(0).inputValue()).toBe('Initial Ben')
    expect(await textInputsAfterReload.nth(1).inputValue()).toBe('Second Ben')
    expect(await textInputsAfterReload.nth(2).inputValue()).toBe('Initial Asset')
    expect(await textInputsAfterReload.nth(3).inputValue()).toBe('Second Asset')

    console.log('Simultaneous adding to multiple groups persisted correctly')
  })
})
