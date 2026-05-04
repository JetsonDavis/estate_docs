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
    throw new Error(`API ${method} ${path} -> ${res.status} ${text}`)
  }
  return res.json()
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`)
  await page.fill('input#username', 'admin')
  await page.fill('input#password', 'password')
  await page.click('button[type="submit"]')
  await page.waitForURL(url => !url.pathname.includes('/login'), { timeout: 10000 })
}

test.describe('Person object details persistence', () => {
  let groupId = 0
  let sessionId = 0
  let personQuestionId = 0

  test.beforeEach(async ({ page }) => {
    const tag = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    const group = await api('POST', '/question-groups', {
      name: `E2E_PersonObjectDetails_${tag}`,
      identifier: `e2e_person_details_${tag}`,
      description: 'Auto-created by e2e test',
      display_order: 999,
    })
    groupId = group.id

    const question = await api('POST', `/question-groups/${groupId}/questions`, {
      question_group_id: groupId,
      question_text: 'Who is the trustor?',
      question_type: 'person',
      identifier: 'trustor',
      repeatable: false,
      display_order: 0,
    })
    personQuestionId = question.id

    const session = await api('POST', '/sessions/', {
      client_identifier: `E2E_PERSON_DETAILS_${tag}`,
      starting_group_id: groupId,
    })
    sessionId = session.id

    await login(page)
  })

  test.afterEach(async () => {
    if (sessionId) {
      try { await api('DELETE', `/sessions/${sessionId}`) } catch { /* ignore */ }
    }
    if (groupId) {
      try { await api('DELETE', `/question-groups/${groupId}`) } catch { /* ignore */ }
    }
  })

  test('persists full inline person details after reload', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto(`${BASE}/document?session=${sessionId}`)
    await page.waitForSelector('text=Who is the trustor?', { timeout: 15000 })

    const nameInput = page.locator('input[placeholder="Full name"]').first()
    await nameInput.fill('Jordan Details')
    await nameInput.blur()

    await page.locator('summary').filter({ hasText: 'Details' }).first().click()
    const details = page.locator('details').first()

    await details.locator('input[type="email"]').first().fill('jordan.details@example.com')
    await details.locator('input[type="email"]').first().blur()
    await details.locator('input[type="tel"]').first().fill('555-0102')
    await details.locator('input[type="tel"]').first().blur()
    await details.locator('input[type="date"]').first().fill('1980-02-03')
    await details.locator('input[type="date"]').first().blur()

    const textInputs = details.locator('input[type="text"]')
    await textInputs.nth(1).fill('Acme Trust Co')
    await textInputs.nth(1).blur()
    await textInputs.nth(2).fill('Trustor')
    await textInputs.nth(2).blur()
    await details.locator('input[placeholder="Street address"]').first().fill('123 Main St')
    await details.locator('input[placeholder="Street address"]').first().blur()
    await textInputs.nth(5).fill('Phoenix')
    await textInputs.nth(5).blur()
    await details.locator('select').first().selectOption('AZ')
    await textInputs.nth(6).fill('85001')
    await textInputs.nth(6).blur()

    await page.getByRole('button', { name: 'Exit' }).click()
    await page.waitForURL(url => url.pathname === '/document', { timeout: 10000 })

    const session = await api('GET', `/sessions/${sessionId}`)
    const answer = session.answers.find((a: any) => a.question_id === personQuestionId)
    expect(answer).toBeTruthy()
    const stored = JSON.parse(answer.answer_value)
    expect(stored).toMatchObject({
      name: 'Jordan Details',
      email: 'jordan.details@example.com',
      phone_number: '555-0102',
      date_of_birth: '1980-02-03',
      employer: 'Acme Trust Co',
      occupation: 'Trustor',
      mailing_address: {
        line1: '123 Main St',
        city: 'Phoenix',
        state: 'AZ',
        zip: '85001',
      },
    })

    await page.goto(`${BASE}/document?session=${sessionId}`)
    await page.waitForSelector('text=Who is the trustor?', { timeout: 15000 })
    await expect(page.locator('input[placeholder="Full name"]').first()).toHaveValue('Jordan Details')
    await page.locator('summary').filter({ hasText: 'Details' }).first().click()
    await expect(page.locator('details').first().locator('input[type="email"]').first()).toHaveValue('jordan.details@example.com')
    await expect(page.locator('details').first().locator('input[type="tel"]').first()).toHaveValue('555-0102')
  })
})
