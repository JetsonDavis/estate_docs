/**
 * Regression: "test error" group — Insert Question on Q1 must not land as last main-level card.
 * Only main-level rows use .question-builder; nested questions use a different layout.
 */
import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3005'
const BACKEND_URL = 'http://localhost:8005'
const ADMIN = { email: 'admin', password: 'password' }

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[id="username"]', ADMIN.email)
  await page.fill('input[id="password"]', ADMIN.password)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)
}

async function findTestErrorGroupId(page: Page): Promise<number | null> {
  const res = await page.request.get(`${BACKEND_URL}/api/v1/question-groups?page=1&per_page=100`)
  if (!res.ok()) return null
  const data = await res.json()
  const groups = data.question_groups || []
  const g = groups.find((x: { name?: string }) => (x.name || '').toLowerCase() === 'test error')
  return g ? g.id : null
}

/** Identifier values for each main-level .question-builder in DOM order */
async function mainLevelIdentifierOrder(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll('.question-builder')).map(builder => {
      const inp = builder.querySelector<HTMLInputElement>(
        'input[placeholder*="full_name"], input[placeholder*="e.g., full_name"]'
      )
      return inp?.value ?? ''
    })
  })
}

test.describe('test error group — main-level insert', () => {
  test('Insert Question on Q1: second main card is new (empty id), not last after nested content', async ({
    page
  }) => {
    await login(page)
    const gid = await findTestErrorGroupId(page)
    test.skip(!gid, 'No "test error" group in API (seed DB with this group to run)')

    await page.goto(`${BASE_URL}/admin/question-groups/${gid}/edit`)
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('text=Questions', { timeout: 15000 })
    await page.waitForTimeout(1500)

    const beforeMain = await page.locator('.question-builder').count()
    expect(beforeMain).toBeGreaterThanOrEqual(1)

    const beforeOrder = await mainLevelIdentifierOrder(page)
    expect(beforeOrder[0]).toContain('is_raining')

    await page.locator('button[title="Insert a new question after this one"]').first().scrollIntoViewIfNeeded()
    await page.locator('button[title="Insert a new question after this one"]').first().click()
    await page.waitForTimeout(2500)

    const afterMain = await page.locator('.question-builder').count()
    expect(afterMain).toBe(beforeMain + 1)

    const afterOrder = await mainLevelIdentifierOrder(page)
    expect(afterOrder[0]).toContain('is_raining')
    expect(afterOrder[1]).toBe('')

    // Remove the new main-level question so the DB stays usable for repeat runs
    const removeSecond = page.locator('.question-builder').nth(1).locator('[data-testid^="remove-question"]')
    await removeSecond.click()
    await page.waitForTimeout(2000)

    const finalCount = await page.locator('.question-builder').count()
    expect(finalCount).toBe(beforeMain)
  })
})
