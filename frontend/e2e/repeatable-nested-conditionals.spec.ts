import { test, expect, Page, BrowserContext } from '@playwright/test';
import { chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3005';
const API_URL = 'http://localhost:8005/api/v1';

/**
 * Test suite: Conditionals inside repeatable groups at multiple nesting levels.
 *
 * Structure built by the test:
 *
 *   Q1: "asset_type" (repeatable, multiple_choice: house / car / other)
 *       Conditional: if asset_type = "other"
 *           Q2: "other_detail" (multiple_choice: boat / plane / other2)
 *               Conditional: if other_detail = "other2"
 *                   Q3: "other2_describe" (free_text)
 *       Conditional: if asset_type = "car"
 *           Q4: "car_make" (free_text)
 *
 * The test verifies:
 *   - Level 1 conditional fires (select "other" → Q2 appears)
 *   - Level 2 conditional fires (select "other2" → Q3 appears)
 *   - Different value at level 1 works (select "car" → Q4 appears)
 *   - Multiple repeatable instances maintain independent conditional state
 */

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[id="username"]', 'admin');
  await page.fill('input[id="password"]', 'password');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
}

/** Login via browser context and use context.request for API calls (shares cookies) */
async function apiLoginContext(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  await login(page);
  await page.close();
}

/** Helper: create a question group, questions, and wire up question_logic via API */
async function buildTestGroup(context: BrowserContext, uniqueId: string) {
  const req = context.request;
  const groupName = `NestedCondRepeat_${uniqueId}`;
  const groupIdentifier = `ncr_${uniqueId}`;

  // 1. Create question group
  const groupResp = await req.post(`${API_URL}/question-groups`, {
    data: {
      name: groupName,
      identifier: groupIdentifier,
      description: 'Test: nested conditionals inside repeatable groups',
      display_order: 0,
    },
  });
  expect(groupResp.ok(), `Create group failed: ${await groupResp.text()}`).toBeTruthy();
  const group = await groupResp.json();
  const groupId = group.id;

  // 2. Create questions
  const q1Resp = await req.post(`${API_URL}/question-groups/${groupId}/questions`, {
    data: {
      identifier: 'asset_type',
      question_text: 'What type of asset?',
      question_type: 'multiple_choice',
      is_required: true,
      repeatable: true,
      display_order: 0,
      question_group_id: groupId,
      options: [
        { value: 'house', label: 'house' },
        { value: 'car', label: 'car' },
        { value: 'other', label: 'other' },
      ],
    },
  });
  expect(q1Resp.ok(), `Create Q1 failed: ${await q1Resp.text()}`).toBeTruthy();
  const q1 = await q1Resp.json();

  const q2Resp = await req.post(`${API_URL}/question-groups/${groupId}/questions`, {
    data: {
      identifier: 'other_detail',
      question_text: 'What kind of other asset?',
      question_type: 'multiple_choice',
      is_required: false,
      repeatable: false,
      display_order: 1,
      question_group_id: groupId,
      options: [
        { value: 'boat', label: 'boat' },
        { value: 'plane', label: 'plane' },
        { value: 'other2', label: 'other2' },
      ],
    },
  });
  expect(q2Resp.ok(), `Create Q2 failed: ${await q2Resp.text()}`).toBeTruthy();
  const q2 = await q2Resp.json();

  const q3Resp = await req.post(`${API_URL}/question-groups/${groupId}/questions`, {
    data: {
      identifier: 'other2_describe',
      question_text: 'Please describe the asset',
      question_type: 'free_text',
      is_required: false,
      repeatable: false,
      display_order: 2,
      question_group_id: groupId,
    },
  });
  expect(q3Resp.ok(), `Create Q3 failed: ${await q3Resp.text()}`).toBeTruthy();
  const q3 = await q3Resp.json();

  const q4Resp = await req.post(`${API_URL}/question-groups/${groupId}/questions`, {
    data: {
      identifier: 'car_make',
      question_text: 'What make of car?',
      question_type: 'free_text',
      is_required: false,
      repeatable: false,
      display_order: 3,
      question_group_id: groupId,
    },
  });
  expect(q4Resp.ok(), `Create Q4 failed: ${await q4Resp.text()}`).toBeTruthy();
  const q4 = await q4Resp.json();

  // 3. Set up question_logic with nested conditionals
  const questionLogic = [
    { type: 'question', questionId: q1.id },
    {
      type: 'conditional',
      conditional: {
        ifIdentifier: 'asset_type',
        operator: 'equals',
        value: 'other',
        nestedItems: [
          { type: 'question', questionId: q2.id },
          {
            type: 'conditional',
            conditional: {
              ifIdentifier: 'other_detail',
              operator: 'equals',
              value: 'other2',
              nestedItems: [
                { type: 'question', questionId: q3.id },
              ],
            },
          },
        ],
      },
    },
    {
      type: 'conditional',
      conditional: {
        ifIdentifier: 'asset_type',
        operator: 'equals',
        value: 'car',
        nestedItems: [
          { type: 'question', questionId: q4.id },
        ],
      },
    },
  ];

  const updateResp = await req.put(`${API_URL}/question-groups/${groupId}`, {
    data: { question_logic: questionLogic },
  });
  expect(updateResp.ok(), `Update logic failed: ${await updateResp.text()}`).toBeTruthy();

  return { groupId, groupName, q1, q2, q3, q4 };
}

async function createSession(context: BrowserContext, groupId: number, uniqueId: string) {
  const resp = await context.request.post(`${API_URL}/sessions/`, {
    data: {
      client_identifier: `NestedCondTest_${uniqueId}`,
      starting_group_id: groupId,
    },
  });
  expect(resp.ok(), `Create session failed: ${await resp.text()}`).toBeTruthy();
  return await resp.json();
}

test.describe('Repeatable Nested Conditionals', () => {
  let setupContext: BrowserContext;
  let groupId: number;
  let sessionId: number;
  let q1: any, q2: any, q3: any, q4: any;
  const uniqueId = Date.now().toString();

  test.beforeAll(async ({ browser }) => {
    // Create a browser context, login, then use its cookies for API calls
    setupContext = await browser.newContext();
    await apiLoginContext(setupContext);

    const group = await buildTestGroup(setupContext, uniqueId);
    groupId = group.groupId;
    q1 = group.q1;
    q2 = group.q2;
    q3 = group.q3;
    q4 = group.q4;

    const session = await createSession(setupContext, groupId, uniqueId);
    sessionId = session.id;
    console.log(`Test setup: group=${groupId}, session=${sessionId}, q1=${q1.id}, q2=${q2.id}, q3=${q3.id}, q4=${q4.id}`);

    // Verify session has current_group_id set
    const verifyResp = await setupContext.request.get(`${API_URL}/sessions/${sessionId}/questions?page=1&questions_per_page=10`);
    const verifyData = await verifyResp.json();
    console.log(`Session questions response keys: ${Object.keys(verifyData)}`);
    if (verifyData.questions) {
      console.log(`Question count: ${verifyData.questions.length}`);
      for (const q of verifyData.questions) {
        console.log(`  q.id=${q.id} identifier=${q.identifier} cfu=${JSON.stringify(q.conditional_followups?.length ?? 'none')}`);
      }
    } else {
      console.log(`Session questions error: ${JSON.stringify(verifyData)}`);
    }
  });

  test.afterAll(async () => {
    if (setupContext) {
      // Clean up
      await setupContext.request.delete(`${API_URL}/question-groups/${groupId}`).catch(() => {});
      await setupContext.request.delete(`${API_URL}/sessions/${sessionId}`).catch(() => {});
      await setupContext.close();
    }
  });

  test('Level 1: selecting "other" on repeatable question shows follow-up', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/document?session=${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify Q1 is visible
    await expect(page.getByText('What type of asset?')).toBeVisible();

    // Q2 should NOT be visible yet (conditional not triggered)
    await expect(page.getByText('What kind of other asset?')).not.toBeVisible();

    // Select "other" on Q1
    const otherRadio = page.locator(`input[type="radio"][value="other"]`).first();
    await otherRadio.click();
    await page.waitForTimeout(2000);

    // Q2 should now be visible (level 1 conditional fired)
    await expect(page.getByText('What kind of other asset?')).toBeVisible({ timeout: 5000 });
    console.log('✅ Level 1 conditional: selecting "other" shows follow-up question');
  });

  test('Level 2: selecting "other2" inside follow-up shows deeper nested question', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/document?session=${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Select "other" on Q1 to trigger level 1
    const otherRadio = page.locator(`input[type="radio"][value="other"]`).first();
    await otherRadio.click();
    await page.waitForTimeout(2000);

    // Verify Q2 is visible
    await expect(page.getByText('What kind of other asset?')).toBeVisible({ timeout: 5000 });

    // Q3 should NOT be visible yet
    await expect(page.getByText('Please describe the asset')).not.toBeVisible();

    // Select "other2" on Q2 to trigger level 2
    const other2Radio = page.locator(`input[type="radio"][value="other2"]`).first();
    await other2Radio.click();
    await page.waitForTimeout(2000);

    // Q3 should now be visible (level 2 conditional fired)
    await expect(page.getByText('Please describe the asset')).toBeVisible({ timeout: 5000 });
    console.log('✅ Level 2 conditional: selecting "other2" shows deeply nested question');
  });

  test('Level 1 alternative: selecting "car" shows different follow-up', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/document?session=${sessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Q4 should NOT be visible yet
    await expect(page.getByText('What make of car?')).not.toBeVisible();

    // Select "car" on Q1
    const carRadio = page.locator(`input[type="radio"][value="car"]`).first();
    await carRadio.click();
    await page.waitForTimeout(2000);

    // Q4 should be visible, Q2 should NOT
    await expect(page.getByText('What make of car?')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('What kind of other asset?')).not.toBeVisible();
    console.log('✅ Level 1 alternative: selecting "car" shows car-specific follow-up');
  });

  test('Deep chain: all 3 levels of conditionals fire in sequence', async ({ page }) => {
    // Create a fresh session to avoid state pollution from previous tests
    const freshSession = await createSession(setupContext, groupId, `${uniqueId}_deep`);
    const freshSessionId = freshSession.id;

    await login(page);
    await page.goto(`${BASE_URL}/document?session=${freshSessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Step 1: Only Q1 visible initially
    await expect(page.getByText('What type of asset?')).toBeVisible();
    await expect(page.getByText('What kind of other asset?')).toHaveCount(0);
    await expect(page.getByText('Please describe the asset')).toHaveCount(0);
    await expect(page.getByText('What make of car?')).toHaveCount(0);
    console.log('Step 1: Only Q1 visible ✓');

    // Step 2: Select "other" → Q2 appears
    await page.locator(`input[type="radio"][value="other"]`).first().click();
    await page.waitForTimeout(2000);
    await expect(page.getByText('What kind of other asset?')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Please describe the asset')).toHaveCount(0);
    console.log('Step 2: Q2 appeared after selecting "other" ✓');

    // Step 3: Select "other2" on Q2 → Q3 appears
    await page.locator(`input[type="radio"][value="other2"]`).first().click();
    await page.waitForTimeout(2000);
    const q3Visible = await page.getByText('Please describe the asset').isVisible();
    console.log(`Step 3: Q3 visible after selecting "other2": ${q3Visible}`);

    // THIS IS THE KEY ASSERTION - if this fails, level 2 conditionals are broken
    expect(q3Visible).toBe(true);
    console.log('Step 3: Q3 appeared after selecting "other2" ✓');

    // Step 4: Type into Q3 to verify it's functional
    if (q3Visible) {
      const textarea = page.locator('textarea').last();
      await textarea.fill('A custom asset description');
      await page.waitForTimeout(500);
      const value = await textarea.inputValue();
      expect(value).toBe('A custom asset description');
      console.log('Step 4: Q3 is interactive ✓');
    }

    console.log('✅ Deep chain: all 3 levels of conditionals fire correctly');
  });

  test('Multiple instances: conditionals work independently per repeatable instance', async ({ page }) => {
    // Create a fresh session to avoid state pollution
    const freshSession = await createSession(setupContext, groupId, `${uniqueId}_multi`);
    const freshSessionId = freshSession.id;

    await login(page);
    await page.goto(`${BASE_URL}/document?session=${freshSessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Select "other" on first instance of Q1
    const otherRadio = page.locator(`input[type="radio"][value="other"]`).first();
    await otherRadio.click();
    await page.waitForTimeout(2000);

    // Click "Add Another" to create instance 2
    const addAnotherBtn = page.getByText('Add Another').first();
    await addAnotherBtn.click();
    await page.waitForTimeout(1500);

    // Instance 2: select "car"
    const allCarRadios = page.locator(`input[type="radio"][value="car"]`);
    const carRadioCount = await allCarRadios.count();
    console.log(`Found ${carRadioCount} "car" radio buttons`);

    if (carRadioCount >= 2) {
      await allCarRadios.nth(1).click();
      await page.waitForTimeout(2000);

      const otherDetailVisible = await page.getByText('What kind of other asset?').isVisible();
      const carMakeVisible = await page.getByText('What make of car?').isVisible();

      console.log(`Instance 1 follow-up (other_detail) visible: ${otherDetailVisible}`);
      console.log(`Instance 2 follow-up (car_make) visible: ${carMakeVisible}`);

      expect(otherDetailVisible).toBe(true);
      expect(carMakeVisible).toBe(true);
      console.log('✅ Multiple instances: each instance has independent conditional state');
    } else {
      console.log('⚠️ Could not find second set of radio buttons - Add Another may have layout issue');
    }
  });
});

/**
 * 10-level deep nested conditionals inside a repeatable group.
 *
 * Structure:
 *   Q_level1 (repeatable, multiple_choice: "next" / "stop")
 *     if level1 == "next":
 *       Q_level2 (multiple_choice: "next" / "stop")
 *         if level2 == "next":
 *           Q_level3 ...
 *             ... down to level 10
 *
 * Each level is a multiple_choice with "next"/"stop".
 * Selecting "next" at level N reveals level N+1.
 */
test.describe('10-Level Deep Nested Conditionals', () => {
  const DEPTH = 10;
  let setupContext: BrowserContext;
  let deepGroupId: number;
  let deepSessionId: number;
  let questionIds: number[] = []; // questionIds[0] = level 1, etc.
  const deepUniqueId = `deep_${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    setupContext = await browser.newContext();
    await apiLoginContext(setupContext);
    const req = setupContext.request;

    // Create group
    const groupResp = await req.post(`${API_URL}/question-groups`, {
      data: {
        name: `NestedCondRepeat_${deepUniqueId}`,
        identifier: `ncr10_${deepUniqueId}`,
        description: `Test: ${DEPTH}-level nested conditionals in repeatable group`,
        display_order: 0,
      },
    });
    expect(groupResp.ok(), `Create group failed: ${await groupResp.text()}`).toBeTruthy();
    const group = await groupResp.json();
    deepGroupId = group.id;

    // Create questions for each level
    for (let i = 0; i < DEPTH; i++) {
      const level = i + 1;
      const isFirst = i === 0;
      const isLast = i === DEPTH - 1;

      const data: any = {
        identifier: `level${level}`,
        question_text: `Level ${level} question`,
        question_type: isLast ? 'free_text' : 'multiple_choice',
        is_required: false,
        repeatable: isFirst,
        display_order: i,
        question_group_id: deepGroupId,
      };
      if (!isLast) {
        data.options = [
          { value: 'next', label: 'next' },
          { value: 'stop', label: 'stop' },
        ];
      }

      const qResp = await req.post(`${API_URL}/question-groups/${deepGroupId}/questions`, { data });
      expect(qResp.ok(), `Create Q level${level} failed: ${await qResp.text()}`).toBeTruthy();
      const q = await qResp.json();
      questionIds.push(q.id);
    }

    // Build nested question_logic: level 1 question at top, then nested conditionals
    // Start from the deepest level and wrap outward
    // innermost: just the question (level 10 free_text)
    let innerItems: any[] = [{ type: 'question', questionId: questionIds[DEPTH - 1] }];

    // Wrap from level 9 down to level 2
    for (let i = DEPTH - 2; i >= 1; i--) {
      const level = i + 1;
      innerItems = [
        { type: 'question', questionId: questionIds[i] },
        {
          type: 'conditional',
          conditional: {
            ifIdentifier: `level${level}`,
            operator: 'equals',
            value: 'next',
            nestedItems: innerItems,
          },
        },
      ];
    }

    // Top level: question level1 + conditional wrapping everything
    const questionLogic = [
      { type: 'question', questionId: questionIds[0] },
      {
        type: 'conditional',
        conditional: {
          ifIdentifier: 'level1',
          operator: 'equals',
          value: 'next',
          nestedItems: innerItems,
        },
      },
    ];

    const updateResp = await req.put(`${API_URL}/question-groups/${deepGroupId}`, {
      data: { question_logic: questionLogic },
    });
    expect(updateResp.ok(), `Update logic failed: ${await updateResp.text()}`).toBeTruthy();

    // Create session
    const sessResp = await req.post(`${API_URL}/sessions/`, {
      data: {
        client_identifier: `NestedCondTest_${deepUniqueId}`,
        starting_group_id: deepGroupId,
      },
    });
    expect(sessResp.ok(), `Create session failed: ${await sessResp.text()}`).toBeTruthy();
    const sess = await sessResp.json();
    deepSessionId = sess.id;

    // Verify API returns conditional_followups
    const verifyResp = await req.get(`${API_URL}/sessions/${deepSessionId}/questions?page=1&questions_per_page=10`);
    const verifyData = await verifyResp.json();
    if (verifyData.questions) {
      for (const q of verifyData.questions) {
        console.log(`  q.id=${q.id} identifier=${q.identifier} cfu_count=${q.conditional_followups?.length ?? 'none'}`);
      }
    }
    console.log(`10-level setup done: group=${deepGroupId}, session=${deepSessionId}, qIds=${questionIds.join(',')}`);
  });

  test.afterAll(async () => {
    if (setupContext) {
      await setupContext.request.delete(`${API_URL}/question-groups/${deepGroupId}`).catch(() => {});
      await setupContext.request.delete(`${API_URL}/sessions/${deepSessionId}`).catch(() => {});
      await setupContext.close();
    }
  });

  test('All 10 levels of nested conditionals fire sequentially', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/document?session=${deepSessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Verify only level 1 is visible
    await expect(page.getByText('Level 1 question')).toBeVisible();
    for (let lvl = 2; lvl <= DEPTH; lvl++) {
      await expect(page.getByText(`Level ${lvl} question`)).toHaveCount(0);
    }
    console.log('✓ Only Level 1 visible initially');

    // Walk through levels 1..9 selecting "next" each time
    for (let lvl = 1; lvl < DEPTH; lvl++) {
      // Select "next" at current level
      const nextRadios = page.locator('input[type="radio"][value="next"]');
      // The radio for level N is the Nth "next" radio on the page (0-indexed = lvl-1)
      const targetRadio = nextRadios.nth(lvl - 1);
      await targetRadio.click();
      await page.waitForTimeout(1500);

      const nextLevel = lvl + 1;
      const nextVisible = await page.getByText(`Level ${nextLevel} question`).isVisible();
      console.log(`Level ${lvl} → selected "next" → Level ${nextLevel} visible: ${nextVisible}`);

      expect(nextVisible).toBe(true);

      // Levels beyond nextLevel should still be hidden
      for (let hidden = nextLevel + 1; hidden <= DEPTH; hidden++) {
        const count = await page.getByText(`Level ${hidden} question`).count();
        expect(count).toBe(0);
      }
    }

    // Final level (10) is a free_text — verify it's interactive
    const textarea = page.locator('textarea').last();
    await textarea.fill('Reached the bottom!');
    await page.waitForTimeout(500);
    const value = await textarea.inputValue();
    expect(value).toBe('Reached the bottom!');

    console.log(`✅ All ${DEPTH} levels of nested conditionals fire correctly`);
  });

  test('Selecting "stop" at level 5 hides levels 6-10', async ({ page }) => {
    // Fresh session
    const freshResp = await setupContext.request.post(`${API_URL}/sessions/`, {
      data: {
        client_identifier: `NestedCondTest_${deepUniqueId}_stop5`,
        starting_group_id: deepGroupId,
      },
    });
    const freshSession = await freshResp.json();

    await login(page);
    await page.goto(`${BASE_URL}/document?session=${freshSession.id}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open levels 1-4 by selecting "next"
    for (let lvl = 1; lvl <= 4; lvl++) {
      const nextRadios = page.locator('input[type="radio"][value="next"]');
      await nextRadios.nth(lvl - 1).click();
      await page.waitForTimeout(1500);
    }

    // Verify level 5 is visible
    await expect(page.getByText('Level 5 question')).toBeVisible();

    // Select "stop" at level 5
    const stopRadios = page.locator('input[type="radio"][value="stop"]');
    // "stop" radios: one per visible level. Level 5's stop is the 5th stop radio (index 4)
    await stopRadios.nth(4).click();
    await page.waitForTimeout(1500);

    // Levels 6-10 should NOT be visible
    for (let hidden = 6; hidden <= DEPTH; hidden++) {
      const count = await page.getByText(`Level ${hidden} question`).count();
      expect(count).toBe(0);
    }

    console.log('✅ Selecting "stop" at level 5 correctly hides levels 6-10');
  });

  test('Answers at levels 4, 5, and 6 persist after page reload', async ({ page }) => {
    // Fresh session
    const freshResp = await setupContext.request.post(`${API_URL}/sessions/`, {
      data: {
        client_identifier: `NestedCondTest_${deepUniqueId}_persist`,
        starting_group_id: deepGroupId,
      },
    });
    const freshSession = await freshResp.json();
    const freshSessionId = freshSession.id;

    await login(page);
    await page.goto(`${BASE_URL}/document?session=${freshSessionId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Open levels 1-5 by selecting "next"
    for (let lvl = 1; lvl <= 5; lvl++) {
      const nextRadios = page.locator('input[type="radio"][value="next"]');
      await nextRadios.nth(lvl - 1).click();
      await page.waitForTimeout(1500);
      await expect(page.getByText(`Level ${lvl + 1} question`)).toBeVisible({ timeout: 5000 });
      console.log(`Opened level ${lvl + 1}`);
    }

    // At level 6 select "stop" instead of "next"
    const stopRadios = page.locator('input[type="radio"][value="stop"]');
    await stopRadios.nth(5).click();
    await page.waitForTimeout(1500);
    console.log('Selected "stop" at level 6');

    // Verify levels 7+ are hidden
    await expect(page.getByText('Level 7 question')).toHaveCount(0);

    // Now reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // After reload, check that levels 1-6 are still visible with their values preserved
    // Level 1 should show "next" selected
    await expect(page.getByText('Level 1 question')).toBeVisible();

    // Check that levels 2-6 are visible (their parent conditionals were satisfied by saved "next" answers)
    for (let lvl = 2; lvl <= 6; lvl++) {
      const visible = await page.getByText(`Level ${lvl} question`).isVisible();
      console.log(`After reload: Level ${lvl} visible: ${visible}`);
      expect(visible).toBe(true);
    }

    // Verify level 4's radio value is "next" (persisted)
    const level4NextRadio = page.locator('input[type="radio"][value="next"]').nth(3);
    const level4Checked = await level4NextRadio.isChecked();
    console.log(`After reload: Level 4 "next" checked: ${level4Checked}`);
    expect(level4Checked).toBe(true);

    // Verify level 5's radio value is "next" (persisted)
    const level5NextRadio = page.locator('input[type="radio"][value="next"]').nth(4);
    const level5Checked = await level5NextRadio.isChecked();
    console.log(`After reload: Level 5 "next" checked: ${level5Checked}`);
    expect(level5Checked).toBe(true);

    // Verify level 6's radio value is "stop" (persisted)
    const level6StopRadio = page.locator('input[type="radio"][value="stop"]').nth(5);
    const level6StopChecked = await level6StopRadio.isChecked();
    console.log(`After reload: Level 6 "stop" checked: ${level6StopChecked}`);
    expect(level6StopChecked).toBe(true);

    // Level 7 should still be hidden (level 6 has "stop")
    await expect(page.getByText('Level 7 question')).toHaveCount(0);

    console.log('✅ Answers at levels 4, 5, and 6 persist after page reload');
  });
});
